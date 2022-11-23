---
title: "Windows Internals: Importing additional functions with modules in memory"
date: 2022-5-2
category: reverse_engineering
tags:
 - reverse engineering
 - malware analysis
 - windows internals
toc: true
permalink: /malware/windows_internals/peb_function_imports
excerpt: Writeup for understanding how to parse the PEB in memory to utilize additional functions and modules.
---

# Introduction

Malware will often utilize out-of-the-box techniques to perform what seems to be a fairly simple task.
For example, if you wanted to print something in C you'd do something similar to the following lines of code.

```c
#include <stdio.h>

int main(){
    printf("hello!");
}
```

By importing `stdio.h` our program gains the ability, among other things, to call `printf`.
Behind the scenes when the program is compiled a lot goes on to allow this to work, things that most programs never have to see or even think about that.
However, malware authors can't always import libraries.
For example, if they inject shellcode into a process it would be impossible to simply call `printf`.

There are many ways to load additional functions to a process, however, in this post we will discuss parsing the process environment block and locating modules in memory.

# Process

## PEB

The process environment block (`PEB`) is unique to each process.
It stores metadata about the process and critical information that the OS uses to properly load and execute its threads.

The `PEB` can be located in a few ways.
It is stored in the thread environment block (`TEB`) which is similar to the `PEB`, but it is unique to each thread instead of processes.

Within the `TEB` the `PEB` is found at `TEB[0x60]`, and the `TEB` itself can be found at `FS:[0x18]` on 32-bit processes.
The `PEB` can also be found within the `FS` register at locations `FS:[0x30]` for 32-bit.

```bash
dt _teb
```

<figure  class="align-center">
  <a href="/assets/images/posts/win_internals/peb/teb_struct.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/teb_struct.png" alt=""></a>
  <figcaption></figcaption>
</figure>

**Note:** All offsets will refer to 32-bit binaries.
{: .notice--warning}

Within the `PEB` there is a field at `0x0C` called `LDR` which is of type `_PEB_LDR_DATA`.

```bash
dt _peb
```

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/peb_struct.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/peb_struct.png" alt=""></a>
  <figcaption></figcaption>
</figure>

## PEB_LDR_DATA

The `_PEB_LDR_DATA` structure stores metadata regarding the modules loaded in a process.
The important fields in it are `InLoadOrderModuleList`, `InMemoryOrderModuleList`, `InInitializationOrderModuleList` which are all linked list of the type `_LIST_ENTRY` containing the type `LDR_DATA_TABLE_ENTRY`.

```bash
dt _peb_ldr_data
```

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/peb_ldr_data_struct.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/peb_ldr_data_struct.png" alt=""></a>
  <figcaption></figcaption>
</figure>

Each list contains the same data, the loaded modules, however, each different list orders them differently.

- `InLoadOrderModuleList` sorts based on load order
- `InMemoryOrderModuleList` sorts based on how the modules are loaded in memory
- `InInitializationOrderModuleList` sorts based on initialization

We will be focusing on `InMemoryOrderModuleList`.

## LDR_DATA_TABLE_ENTRY

`InMemoryOrderModuleList` points at **both** a `Flink` within the `_LIST_ENTRY` structure and a `InMemoryOrderLinks` within `_LDR_DATA_TABLE_ENTRY`.

```bash
dt _list_entry
```

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/list_entry.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/list_entry.png" alt=""></a>
  <figcaption></figcaption>
</figure>

The `_LDR_DATA_TABLE_ENTRY` contains metadata regarding a specific module.
To access a field within the `_LDR_DATA_TABLE_ENTRY` you’ll need to subtract `0x8` from the field because the pointer is pointing 8 bytes into the structure at `InMemoryOrderLinks`.

For example `SizeOfImage` would be at `0x18`, not `0x20`.

```bash
dt _ldr_data_table_entry
```

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/ldr_data_table_entry_struct.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/ldr_data_table_entry_struct.png" alt=""></a>
  <figcaption></figcaption>
</figure>

Within the `_LDR_DATA_TABLE_ENTRY` there are a few useful fields.

- `DllBase`: the relative address to the beginning of the DLL
- `EntryPoint`: the relative address to the entry point of the DLL
- `FullDllName`: the path and name of the DLL
- `BaseDllName`: the name of the DLL

Once `InMemoryOrderModuleList` is acquired all you need to do is parse the linked list until the correct module is located.

## Acquiring InMemoryOrderModuleList and finding KERNEL32

In this example, let's assume we need to find `KERNEL32.DLL`. For `InMemoryOderModuleList` the very first module is the current program, with the second being `NTDLL.DLL`, and the third being `KERNEL32.DLL`.

The following code snippet locates the `LDR_DATA_TABLE_ENTRY` for `KERNEL32.DLL` and stores it in `EBX`, its name is stored in `ESI` and the base address is stored at `EDI`.

```c
#include <stdio.h>

int main(void) {
    __asm
    {
      mov ebx, fs:[0x30]        // PEB
      mov ebx, [ebx + 0xc]      // LDR
      mov ebx, [ebx + 0x14]     // InMemoryOrderModuleList

      mov ebx, [ebx]            // NTDLL
      mov ebx, [ebx]            // KERNEL32

      mov esi, [ebx + 0x28]     // FullDLLName String
      mov edi, [ebx + 0x10]     // DllBase
    }
}

```

## Parsing the PE File

Once the DLL base is acquired a few sanity checks need to occur to ensure we are actually in the right location.

The first check is to ensure we are actually within a PE file. At offset 0 the value should be "MZ". Which are the magic bytes for a PE file.
However, if the data at 0 is treated as an integer it would be represented as `0x5A4D` due to endianness.

After we are sure that it is a PE file we need to locate the PE header location. The offset to it is found at offset `0x3C`.

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/pe_offset.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/pe_offset.png" alt=""></a>
  <figcaption></figcaption>
</figure>

Once there it is important to check for the value "PE" or `0x4550`.

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/pe_signature.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/pe_signature.png" alt=""></a>
  <figcaption></figcaption>
</figure>

After the PE header is found the export table needs to be located. This can be found at `0x78` bytes after the PE header. In this case, it was at offset `0x170`

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/export_table.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/export_table.png" alt=""></a>
  <figcaption></figcaption>
</figure>

The export table contains many useful offsets. However, the most important are the Ordinal Table and the Name Pointer Table RVA which are located at offsets `0x1C` and `0x20` within the export directory.

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/export_directory.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/export_directory.png" alt=""></a>
  <figcaption></figcaption>
</figure>

To find a function requires a three-step process.
First, it needs to locate within the Name Pointer Table to determine its location in the ordinal table.
Then within the Ordinal table, you can retrieve its ordinal.
After that, you can use the ordinal as an offset within the address table.

If you were looking for `CreateFileW` it would take `0xCB` iterations.

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/createfile_name_pointer.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/createfile_name_pointer.png" alt=""></a>
  <figcaption></figcaption>
</figure>

From there you can calculate its location within the ordinal table with the following code. In this example, it ends up being `0x7F696`.

```c
int ordinalTable = 0x7F500
int functionIndex = 0xCB
int functionOrdinal = ordinalTable + functionIndex * 2;
```

Here the ordinal of the function can be acquired. In this case, it is `0xCD`.

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/createfile_ordinal.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/createfile_ordinal.png" alt=""></a>
  <figcaption></figcaption>
</figure>

With the ordinal known, you now have to go to the Address Table.
The offset of the function happens to be 0x235A0.

```c
int addressTable = 0x7C2E8
int ordinal = 0xCD
int functionAddress = addressTable + ordinal * 4;
```

<figure class="align-center">
  <a href="/assets/images/posts/win_internals/peb/address_table.png" title="" alt="">
  <img src="/assets/images/posts/win_internals/peb/address_table.png" alt=""></a>
  <figcaption></figcaption>
</figure>

By adding that to the DLL base you can get the address of the function.

After locating the function address you can call it normally.
This opens up a lot of different techniques.
For example, if you locate `LoadLibraryA`, and `GetProcAddress` (both located in KERNEL32) you can then start to load additional modules that weren't previously loaded.

# Conclusion

Hopefully, after reading this you've gained insight into how you can parse internal Windows structure to add additional functionality to programs.

In the next section are websites and blog posts that I read while writing this up that hopefully are useful.

# Useful Links

- [LDR_DATA_TABLE_ENTRY Structure](https://www.geoffchappell.com/studies/windows/km/ntoskrnl/inc/api/ntldr/ldr_data_table_entry.htm?tx=205,207)
- [PEB_LDR_DATA Structure - MSDN](https://docs.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-peb_ldr_data)
- [PEB_LDR_DATA Structure](https://www.geoffchappell.com/studies/windows/km/ntoskrnl/inc/api/ntpsapi_x/peb_ldr_data.htm?tx=207)
- [PEB Structure](https://www.geoffchappell.com/studies/windows/km/ntoskrnl/inc/api/pebteb/peb/index.htm)
- [PEB Structure - MSDN](https://docs.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-peb)
- [LIST_ENTRY Structure - MSDN](https://docs.microsoft.com/en-us/windows/win32/api/ntdef/ns-ntdef-list_entry)
- [Finding Kernel32 Base and Function Addresses in Shellcode](https://www.ired.team/offensive-security/code-injection-process-injection/finding-kernel32-base-and-function-addresses-in-shellcode)
- [Windows PEB parsing – A binary with no imports](https://bidouillesecurity.com/windows-peb-parsing-a-binary-with-no-imports/)
- [Locating DLL Name from the Process Environment Block (PEB)](https://0xevilc0de.com/locating-dll-name-from-the-process-environment-block-peb/)
