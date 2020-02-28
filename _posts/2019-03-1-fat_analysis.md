---
title: "FAT32 Analysis"
date: 2019-03-1 14:31
category: ctf
tags: 
 - fat32
toc: true
authors: "Jordan Sosnowski, Demarcus Campbell, Grant Pinkert"
---


In this post I will discuss analyzing the FAT32 file system.
This is based on a project I had at Auburn University for my Digital Forensics course taught by Jason Cuneo.


We were tasked with analyzing a disk image files: FAT.dd. With this images, we found the number of partitions and
attempted to find existing and deleted files. For each file, we
specified the hexadecimal address while also generating the FATs for the
FAT image. We were able to recover several JPEG images as well as several
PDFs while identifying several deleted files and subsequently recovering
those as well.

# Introduction


For this project we were given an image file, FAT.dd. 
With this file, we were tasked with finding out the details of each image.
For both the FAT image we were to find the
starting hexadecimal storage address. 
This address is needed because with each image, there is a small offset in the beginning with some
image information, such as the partitions, the partition types, etc. which is needed to find out where each partition starts.

Since this is a FAT image, we will need to generate the File Allocation Table. 
This table is comprised of a map showing where the clusters in the data area is located as well as how many active files are in the partition. 
After that we can go to the root directory, here we will find information about the file's name, size, if its deleted, etc. 
From the information
found in the FAT and root directory we can locate the file in the data
area and attempt to recover it.

After grabbing all these values for the various partitions and images we
can finally attempt to recover the files. Deleted files are recovered
just like the normal files. However, some deleted and active files are
fragmented and are unable to be recovered using the normal process we
would use for DD, to recover them it is easier to use icat.

## FAT Image

![](/assets/images/posts/fat32/fat_header.png)
Figure 1 -- Active Disk Editor Partition Records
Master Boot Record Example

Using Active Disk Editor, we can find the start of each partition.
Partition I's first sector is located at 2048 (offset 0x1C6 from the
beginning of the image). 
Partition II's first sector is located at 202,049 (offset 0x1D6). 
Partition III's first sector is located at 402,050 (offset 0x1E6). 
We can also see each partition file system ID's located at 0x01C2, 0x01D2, 0x01E2 respectively. 
They are all 0x0E which
symbolizes FAT16.

Now that we have their sector locations, we need the offset in bytes. To
calculate this, you need to multiply the sector by the value of bytes
per sectors, we will assume the sector per byte count is 512.
Sectors are usually 512 bytes, sometimes 4096. 
One can see exactly how big a sector is in the partition's reserved area.
Partitions in this image are located at the following address:

-   Partition I: 2048 \* 512 = 1,048,576

-   Partition II: 202,049 \* 512 = 103,449,088

-   Partition III: 402,050 \* 512 = 205,849,600

![](/assets/images/posts/fat32/fdisk.png)
Figure 2 - Fdisk Example

We can corroborate this information by using the tool fdisk. Using fdisk
with the switch 'l' and the image's path it will list the disks
partitions and information about it. As you can see each sector is sized
512 bytes and that the partitions start at the values that we got from
the hex dump.

## SEC PICS

We will not actually view the raw image in Active Disk Editor, but
instead view each partition individually. 
This will make the address smaller due to the fact that the partitions offsets are not being added.
We will have to add each partition\'s offset back when recovering the
files however. 
That aside we will go to the first FAT Partition SEC PICS. 
This will bring us to the first reserved sector of the FAT
partition. 

### Reserved Sector

Here we can grab: bytes/sector, sectors/cluster, reserved
sectors, number of fats, root entries, and total sectors.

|--------------+-------------+----------------|
| Name         | Offset      | Value          |      
|:------------:+:-----------:+:--------------:|
| Byte/Sector | 0x00B | 512 | 
| Sector/Cluster | 0x00D|	4|
| Number of FATs | 0x010|	2|
| Root Entries | 0x011|	1|
|--------------+-------------+----------------|

|--------------+-------------+----------------|
|Name	| Offset |	Value |
|:------------:+:-----------:+:--------------:|
|Total Sectors [small] |	0x013 | 0 |
|Sectors Per FAT |	0x016 |	195 |
|Total Sectors [large] |	0x020 |	200,001 |
|--------------+-------------+----------------|


![](/assets/images/posts/fat32/reserved_sector.png)
Figure 3 - Active Disk Editor FAT Reserved Sector

With the information we gathered above we can create a layout for the
FAT structure. 
We know that the reserved sectors consist of 2 sectors,
each FAT is 195. 
However, we do not know inherently how big the root
directory is. 
However, we do have how many entry's we have in the root and we know that each entry is always 32 bytes. We know that the root
directory is 16,384 total bytes (512 entries \* 32 bytes) and from that
we know that its 32 sectors long (16,384 bytes / 512 bytes/sector). 
We also know that there is a total of 200,001 sectors and we know where the root directory ends (reserved sector + 1^st^ FAT + 2^nd^ FAT + Root) which is 424. 
To get the size of the data area we can subtract 200,001 from 424 which gives us 199,579 sectors for the Data Area, and it starts
at 424. 
From this information we can generate the image below.

![](/assets/images/posts/fat32/fat_format.png)
Figure 4 - FAT Format

### 1st FAT Area

After generating the layout of the partition, we will go to the 1^st^
FAT area to see how the clusters are allocated. 
The first FAT is located at sector 2; which, in bytes, is 1024 (0x400). 
At that location we see the below image. 
For FAT16 each cluster takes up two bytes in the FAT. 
The first two entries are special values. The first entry in the FAT is the FAT ID, 0xF0 indicates a volume on a non-partition supper floppy drive, and 0xF8 for partitioned disks \[1\]. 
The second entry is the end of chain indicator, so for this FAT 0xFFFF marks the end of a chain.

![](/assets/images/posts/fat32/fat_entry.png)
Figure 5 - FAT Entry

After these special entries start actual files. 
The first few files on a partition are usually system files but we cannot always assume that.
However, we can create the chart listed below from FAT. 
The green entries are user files that are active. The blue entries are empty clusters, which may or may not contain deleted files. The black entries are the special entries, and the orange ones are assumed to be system files. Which we can validate later in the root directory. After analyzing the FAT, we can go to the root directory.

![](/assets/images/posts/fat32/clusters.png)


<!-- |--------------------------------------+------+-+------------+------------------------+------|
|   Cluster   | Next Cluster           | Type | |  Cluster   | Next Cluster           | Type |
|:------------:+:---------------------:+:----:+:--:+:---------:+:----------------------:+:----:|
| 0x0000  | 0xFFF8 | Special|  | 0x001A  | 0x0000 | Empty |
| 0x0001  | 0xFFFF | Special| | 0x001B  | 0x0000 | Empty |
| 0x0002  | 0xFFFF | System | | 0x001C  | 0x0000 | Empty |
| 0x0003  | 0xFFFF | System || 0x001D  | 0x0000 | Empty |
| 0x0004  | 0xFFFF | System || 0x001E  | 0x001F | Active |
| 0x0005  | 0x0006 | Active || 0x001F  | 0x0020 | Active |
| 0x0006  | 0x0007 | Active || 0x0020  | 0x0021 | Active |
| 0x0007  | 0x0008 | Active || 0x0021  | 0x0022 | Active |
| 0x0008  | 0x0009 | Active || 0x0022  | 0x0023 | Active |
| 0x0009  | 0x000A | Active || 0x0023  | 0x0024 | Active |
| 0x000A  | 0xFFFF | Active || 0x0024  | 0xFFFF | Active |
| 0x000B  | 0x0000 | Empty || 0x0025  | 0x0000 | Empty |
| 0x000C  | 0x0000 | Empty || 0x0026  | 0x0000 | Empty |
| 0x000D  | 0x0000 | Empty || 0x0027  | 0x0000 | Empty |
| 0x000E  | 0x0000 | Empty || 0x0028  | 0x0000 | Empty |
| 0x000F  | 0x0000 | Empty || 0x0029  | 0x0000 | Empty |
| 0x0010  | 0x0000 | Empty || 0x002A  | 0x0000 | Empty |
| 0x0011  | 0x0012 | Active || 0x002B  | 0x0000 | Empty |
| 0x0012  | 0x0013 | Active || 0x002C  | 0x0000 | Empty |
| 0x0013  | 0x0014 | Active || 0x002D  | 0x002E | Active |
| 0x0014  | 0x0015 | Active || 0x002E  | 0x002F | Active |
| 0x0015  | 0x0016 | Active || 0x002F  | 0x0030 | Active |
| 0x0016  | 0x0017 | Active || 0x0030  | 0x0031 | Active |
| 0x0017  | 0xFFFF | Active || 0x0031  | 0x0032 | Active |
| 0x0018  | 0x0000 | Empty || 0x0032  | 0x0033 | Active |
| 0x0019  | 0x0000 | Empty || 0x0033  | 0xFFFF | Active |
|---------------------------------+-----+------+-------------+------------------------+------| -->

### Root Directory 

Based on the table we created earlier the root directory starts at
sector 392, or byte 200,704 (0x31000). 
The root table shows us directory entries, as well as all files, even those that are marked as deleted.
In the root table we find the filename, extension, attribute, modify date, cluster, and the file size, all of which is to be used to extract the file. 
As stated early each listing in the root directory is 32 bytes long. As we assumed earlier the first 3 entries
are system entries. At the fourth entry we can see the user file
Tennesse.JPG.

![](/assets/images/posts/fat32/root_directory.png)
Figure 6 -- Root Directory Entry

Each short entry will follow the same format. 
The entries prior to the short entries are long entries.
These contain the full length of the filename if the short entry cannot hold it; they also use unicode to represent the filename rather than ASCII like the short entries.

From the short entries we can gather the following: file status, filename, file extension, attribute, modified date/time, starting cluster, and file size. 
With this information we can attempt to locate the individual files in the data area and hopefully recover them.

### File Information

![](/assets/images/posts/fat32/tennessee.png)
Figure 7 - FAT Directory Entry for Tennessee.jpg

1.  Tennessee

    a.  Status: 0x41 -- Normal

    b.  Filename: Tennessee

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:31 PM

    f.  Cluster: 0x0005 -- 5

    g.  File Size: 0x0000280C -- 10,252 bytes

![](/assets/images/posts/fat32/ak.png)
Figure 8 - FAT Directory Entry for Arkansas.jpg

2.  Arkansas

    a.  Status: 0xE5 -- Deleted

    b.  Filename: Arkansas

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:30 PM

    f.  Cluster: 0x000B -- 11

    g.  File Size: 0x00002A96 -- 10,902 bytes

![](/assets/images/posts/fat32/au.png)
Figure 8 - FAT Directory Entry for Auburn.jpg

3.  Auburn

    a.  Status: 0x41 -- Normal File

    b.  Filename: Auburn

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified data/time: 2/6/19 11:29 PM

    f.  Cluster: 0x0011 -- 17

    g.  File Size: 0x00003055 -- 12,373 bytes

![](/assets/images/posts/fat32/fl.png)
Figure 8 - FAT Directory Entry for Florida.jpg

4.  Florida

    a.  Status: 0xE5 -- Deleted

    b.  Filename: Florida

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:31 PM

    f.  Cluster: 0x0018 -- 24

    g.  File Size: 0x00002F14 -- 12,052

![](/assets/images/posts/fat32/ga.png)
Figure 8 - FAT Directory Entry for Georgia.jpg

5.  Georgia

    a.  Status: 0x41 -- Normal File

    b.  Filename: Georgia

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:30 PM

    f.  Cluster: 0x001E -- 30

    g.  File size: 0x00003699 -- 13,977 bytes

![](/assets/images/posts/fat32/mi.png)
Figure 8 - FAT Directory Entry for Missouri.jpg

6.  Missouri

    a.  Status: 0xE5 -- Deleted

    b.  Filename: Missouri

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:29 PM

    f.  Cluster: 0x0025 -- 37

    g.  File size: 0x00003E22 -- 15,906 bytes

![](/assets/images/posts/fat32/om.png)
Figure 8 - FAT Directory Entry for Ole Miss.jpg

7.  Ole Miss

    a.  Status: 0x41 -- Normal File

    b.  Filename: Ole Miss

    c.  Extension: JPG

    d.  Attribute: 0x20 -- Archive

    e.  Modified date/time: 2/6/19 11:30 PM

    f.  Cluster: 0x002D -- 45

    g.  File size: 0x0000339B -- 13,211 bytes


### File Recovery

Using all the information, it is now possible to recover the files. 
To retrieve a file, we use the `dd` command as follows:

```bash
sudo dd if=image_name of=filename bs=block_size\ 
skip=blocks_to_skip count=blocks_to_grab status=progress
```

The skip value is the starting position of the file. 
This is found by finding the cluster number for whichever file, subtracting two from it, multiplying that value by the value of bytes per cluster (cluster offset), then adding the cluster offset to data offset (file offset), and then adding that to partition offset (actual offset). 
Using the root directory entry, we can then find the length of the file of bytes, which is used for the count argument. 
Block size is set to 1 in case a file does not end up using full sectors or clusters. 
Using the above information, we can get this table. 
If the commands were run in a terminal with the current directory hosting the fat.dd image the files would be correctly retrieved.

|----------+------------+---------------+---------------+---------------+--------------------------------------------|
| Filename | 	Cluster	| File Length	|Cluster Offset |	File Offset |	Actual Offset	|
|:-------------:+:--:+:--------:+:------:+:--------:+:--------------------------------------:|
| Tennessee.JPG	| 5	 |  10,252	| 6,144	 |  223,232	| 1,271,808	| 
| Arkansas.JPG	| 11 | 	10,902	| 18,432 |	235,520	| 1,284,096	| 
| Auburn.JPG	| 17 | 	12,373	| 30,720 |	247,808	| 1,296,384	| 
| Florida.JPG	| 24 | 	12,502	| 45,056 |	262,144	| 1,310,720	| 
| Georgia.JPG	| 30 | 	13,977	| 57,344 |	274,432	| 1,323,008	| 
| Missouri.JPG	| 37 | 	15,906	| 71,680 |	288,768	| 1,337,344	| 
| Ole Miss.JPG	| 45 | 	13,211	| 88,064 |	305,152	| 1,353,728	| 
|----------+------------+---------------+---------------+---------------+-------------------------------------------|

Command to Retrieve Files:
```bash
sudo dd if=fat.dd of='Tennessee.JPG' bs=1 skip=1271808\
count=10252 status=progress

sudo dd if=fat.dd of='Arkansas.JPG' bs=1 skip=1284096\
count=10902 status=progress

sudo dd if=fat.dd of='Auburn.JPG' bs=1 skip=1296384\
count=12373 status=progress

sudo dd if=fat.dd of='Florida.JPG' bs=1 skip=1310720\
count=12502 status=progress

sudo dd if=fat.dd of='Georgia.JPG' bs=1 skip=1323008\
count=13977 status=progress

sudo dd if=fat.dd of='Missouri.JPG' bs=1 skip=1337344\
count=15906 status=progress

sudo dd if=fat.dd of='Ole Miss.JPG' bs=1 skip=1353728\
count=13211 status=progress
```

### Cross Validation

We can corroborate all the information we found with a Sleuth Kit, which
is a collection of digital forensics tools, that essentially can do all the
work we did in a few lines. 

The first command we will want to use is `mmls`. 
This will give us information about the volume's partitions. 
However we have already ran an equivalent command to that with `fdisk -l`, so we will skip it. 


<figure style="width: 400px" class="align-left">
  <img src="/assets/images/posts/fat32/fsstat.png" alt="">
</figure> 

<br>
The next command we will want to run is `fsstat` which gives us information about the file system. 

Running `fsstat -o 2048 fat.dd` will give us information about the first partition.
Here we can see that our findings about the first FAT partition, SEC PICS, match up exactly.

<br><br><br><br>

After looking at the file systems information we will want to look into the files located in the specific file system. The command we will want to run is `fls`. 
This command will list file and directory names in the disk image. 

**Note** just like for `fsstat` we will
have to give an offset to the correct partition.

Running `fls -o 2048 fat.dd ` we get the following information.

<figure style="width: 600px" class="align-center">
  <img src="/assets/images/posts/fat32/fls.png" alt="">
</figure>


Here we can see the information about the file's names, if they are
deleted, and their inodes. 

Using `istat`, which gives us details about
meta-data structures (i.e. inode), we can print out information about
the specific file. 
Using `istat -o 2048 fat.dd 10`, we can preview
information about Arkansas.JPG.

<figure style="width: 600px" class="align-center">
  <img src="/assets/images/posts/fat32/istat.png" alt="">
</figure>

## CLASSICS

The same methodology can be applied to other FAT Partitions. What
follows will just be a quick rundown of the values found in the classics
partition instead of a detailed analysis.

1.  Structure Size Calculations

    a.  Partition Offset = 0x62A8200 = **103,449,088** bytes

    b.  Bytes / Sector

        i.  Offset 0x0B = 0x0200 = **512**

    c.  Sectors / Cluster

        i.  Offset 0x0D = 0x4 = **4**

    d.  Bytes / Cluster

        i.  4 Sectors / Cluster \* 512 Bytes / Sector = **2048**

    e.  Reserved Sectors

        i.  Offset 0x000E = 0x0002 = **2**

    f.  Number of FATs

        i.  Offset 0x0010 = 0x02 = **2**

    g.  1^st^ FAT Area Size

        i.  Offset 0x0016 = 0x00C3 = **195** sectors

    h.  2^nd^ FAT Area Size

        i.  Offset 0x0016 = 0x00C3 = **195** sectors

    i.  Root Directory

        i.  Directory Entries

            1.  Offset 0x0011 = 0x0200 = 512 entries

        ii. 512 \* 32 bytes = 16,384 bytes / 512 (bytes/sector) = **32**
            sectors

    j.  Data Area

        i.  Total Sectors

            1.  Offset 0x0020 = 0x00030D41 = 200,001 Sectors

        ii. Data Area = Total Sectors -- End of Root

            1.  200,001 -- 424 = **199579** Sectors

[]{#_Toc2964998 .anchor}Figure 18 - Disk Editor

![](media/image18.png){width="6.211220472440945in"
height="5.383720472440945in"}

2.  FAT Structure

[]{#_Toc2964999 .anchor}Figure 19 - FAT Structure

  2                  195              195              32               199,577
  ------------------ ---------------- ---------------- ---------------- -----------
  Reserved Sectors   1^st^ FAT Area   2^nd^ FAT Area   Root Directory   Data Area

3.  File Allocation Table

    a.  Located from sector 2 -- 196

    b.  Bytes 1024 -- 100,352

    c.  Address 0x400 -- 0x18800

  Cluster   Next Cluster
  --------- --------------
  0x0000 | 0xFFF8
  0x0001 | 0xFFFF
  0x0002 | 0xFFFF
  0x0003 | 0xFFFF
  0x0004 | 0xFFFF
  0x0005 | 0x0006
  0x0006 | 0x0007
  0x0007 | 0x0008
  0x0009 | 0x000A
  \...      
  0x061B | 0x061C
  0x061C | 0xFFFF
  0x0000 | 0x000
  ...       
  0x000  | 0x000

As you can see this FAT table is slightly different than the one
earlier. This one only has one linked list while the other had four
separated by three lists of zeros. This table however has one list of
allocated clusters and a large list of zeros. What this means is that
there is one allocated file, and the rest of it is unallocated space.
There could be one massive deleted file in that list of zeros or
multiple deleted files, or no deleted files at all. All we know at this
point is there is one large allocated file, and a large set of
unallocated clusters.

4.  Root Directory Structure

    a.  Sector 392 -- 423

    b.  Byte 200,704 -- 216,576

    c.  Address 0x31000 -- 0x34E00

5.  Root Directory Entries

    a.  Great Expectations

        i.  Status: 0x42

        ii. Filename: Great Expectations

        iii. Extension: PDF

        iv. Attribute: 0x20 -- Archive

        v.  Modified date/time: 2/10/19 2:28 PM

        vi. Cluster: 0x0005 -- 5

        vii. File Size: 0x0000280C -- 3,193,980 bytes

[]{#_Toc2965000 .anchor}Figure 20 - Great Expectations

![](media/image19.png){width="6.5in" height="1.2145833333333333in"}

b.  Pride and Prejudice

    i.  Status: 0xE5 -- Deleted

    ii. Filename: Pride and Prejudice

    iii. Extension: PDF

    iv. Attribute: 0x20 -- Archive

    v.  Modified date/time: 1/18/19 1:01 PM

    vi. Cluster: 0x061D -- 1,565

    vii. File Size: 0x000C303B -- 798,779 bytes

![](media/image20.png){width="6.5in" height="1.2305555555555556in"}

[]{#_Toc2965001 .anchor}Figure 21 - Pride and Predjudice

c.  War and Peace

    i.  Status: 0xE5 -- Deleted

    ii. Filename: War and Peace

    iii. Extension: PDF

    iv. Attribute: 0x20 -- Archive

    v.  Modified date/time: 2/10/19 11:15 AM

    vi. Cluster: 0x07A4 -- 1956

    vii. File Size: 0x009BC0F7 -- 10,207,479

![](media/image21.png){width="6.5in" height="1.2048611111111112in"}

[]{#_Toc2965002 .anchor}Figure 22 - War and Peace

d.  Tale of Two Cities

    i.  Status: 0xE5 -- Deleted

    ii. Filename: Tale of Two Cities

    iii. Extensions: PDF

    iv. Attribute: 0x20 -- Archive

    v.  Modified date/time: 1/18/19 12:58 PM

    vi. Cluster: 0x1B1D -- 6,941

    vii. File Size: 1,316,140 bytes

![](media/image22.png){width="6.5in" height="1.1729166666666666in"}

[]{#_Toc2965003 .anchor}Figure 23 - Tale of Two Cities

6.  File Recovery

[]{#_Toc2965333 .anchor}Table 5 - FAT Partition 2 Recovery

  **Filename**              **Cluster**   **File Length**   **Cluster Offset**   **File Offset**   **Actual Offset**   **Command To Retrieve File**
  ------------------------- ------------- ----------------- -------------------- ----------------- ------------------- ----------------------------------------------------------------------------------------------------
  Great Expectations.pdf    5             3,193,980         6144                 223,232           103,672,320         sudo dd if=fat.dd of= 'Great Expectations.pdf\' bs=1 skip=103672320 count=3193980 status=progress
  Pride and Prejudice.pdf   1,565         798,779           3201024              3,418,112         106,867,200         sudo dd if=fat.dd of= 'Pride and Prejudice.pdf \' bs=1 skip=106867200 count=798779 status=progress
  War and Peace.pdf         1,956         10,207,479        4001792              4,218,880         107,667,968         sudo dd if=fat.dd of=\' War and Peace.pdf' bs=1 skip=107667968 count=10207479 status=progress
  Tale of Two Cities.pdf    6,941         1,316,140         14211072             14,428,160        117,877,248         sudo dd if=fat.dd of=\' Tale of Two Cities.pdf' bs=1 skip=117877248 count=1316140 status=progress

## GIFS

GIFS is a FAT partition similar to SEC PICS and CLASSICS. However, GIFS
is a FAT12 partition. Which does not change much other than the max file
size and how it organizes it's clusters in the FAT area.

1.  Structure Size Calculations

    a.  Partition Offset

        i.  0xC450400 = **205,849,600** bytes

    b.  Bytes / Sector

        i.  Offset 0x0B = 0x0200 = **512**

    c.  Sectors / Cluster

        i.  Offset 0x0D = 0x8 = **8**

    d.  Bytes / Cluster

        i.  8 Sectors / Cluster \* 512 Bytes / Sector = **4096**

    e.  Reserved Sectors

        i.  Offset 0x000E = 0x0008= **8** sectors

    f.  Number of FATs

        i.  Offset 0x0010 = 0x2 = **2**

    g.  1^st^ FAT Area Size

        i.  Offset 0x0016 = 0x8 = **8** sectors

    h.  2^nd^ FAT Area Size

        i.  Offset 0x0016 = 0x8 = **8** sectors

    i.  Root Directory

        i.  Directory Entries

            1.  Offset 0x0011 = 0x0200 = 512 entries

        ii. 512 \* 32 bytes = 16,384 bytes / 512 (bytes/sector) = **32**
            sectors

    j.  Data Area

        i.  Total Sectors

            1.  Offset 0x0013= 0x4E21 = 20,001 Sectors

        ii. Data Area = Total Sectors -- End of Root

            1.  20,001 -- 56 = **19,945** Sectors

2.  FAT Structure

  8                  8                8                32               19,945
  ------------------ ---------------- ---------------- ---------------- -----------
  Reserved Sectors   1^st^ FAT Area   2^nd^ FAT Area   Root Directory   Data Area

3.  File Analysis

    a.  File Allocation Table

        i.  Located from sector 8 -- 15

        ii. Bytes 4096 -- 7,680

        iii. Address 0x1000 -- 0x1E00

Note that for FAT12 each FAT entry is 12 bits. Therefore, the two
special entries for the FAT table below are 0xFF8 and 0xFFF. After that
there are three system files allocated (0xFFF, 0xFFF, 0xFFF). However,
after those there are just zeros, which would indicate that there are no
active user files in this partition. However, there still could be
recoverable deleted files.

![](media/image23.png){width="6.5in" height="0.8020833333333334in"}

  Cluster   Next Cluster
  --------- --------------
  0x000  | 0xFF8
  0x001  | 0xFFF
  0x002  | 0xFFF
  0x003  | 0xFFF
  0x004  | 0xFFF
  0x005  | 0xFFF

4.  Root Directory Structure

    a.  Sector 24 -- 55

    b.  Byte 12,288 -- 28,160

    c.  Address 0x3000 -- 0x6E00

![](media/image24.png){width="6.023254593175853in"
height="2.832088801399825in"}

5.  Root Directory Entries

    a.  Banana

        i.  Status: 0xE5 -- Deleted

        ii. Filename: Banana

        iii. Extension: GIF

        iv. Attribute: 0x20 -- Archive

        v.  Modified date/time: 2/10/19 11:14 AM

        vi. Cluster: 0x0005 -- 5

        vii. File Size: 0x0000280C -- 291,647 bytes

![](media/image25.png){width="6.127999781277341in"
height="0.8105194663167105in"}

b.  Minions

    i.  Status: 0xE5 -- Deleted

    ii. Filename: Minion

    iii. Extension: GIF

    iv. Attribute: 0x20 -- Archive

    v.  Modified date/time: 2/8/19 2:07 PM

    vi. Cluster: 0x007A -- 77

    vii. File Size: 0x0000280C -- 328,174 bytes

![](media/image26.png){width="6.5in" height="0.7673611111111112in"}

6.  File Recovery

[]{#_Toc2965334 .anchor}Table 6 - FAT Partition 3 File Recovery

  **Filename**   **Cluster**   **File Length**   **Cluster Offset**   **File Offset**   **Actual Offset**   **Command To Retrieve File**
  -------------- ------------- ----------------- -------------------- ----------------- ------------------- ---------------------------------------------------------------------------------------
  Banana.GIF     5             291647            12288                40960             205890560           sudo dd if=fat.dd of=\'Banana.GIF\' bs=1 skip=205890560 count=291647 status=progress
  Minions.GIF    77            328174            307200               335872            206185472           sudo dd if=fat.dd of=\'Minions.GIF\' bs=1 skip=206185472 count=328174 status=progress


# Conclusion
============

This project allowed us to delve into a FAT and a NTFS file system. In
doing so, we gained a better understanding of how the formats are
structured, where data is stored, and how the file systems take care of
deleted files.

> Number of FAT Partitions: 3
>
> Number of Active and Deleted Files per Partition (FAT):
>
> SEC Pics: 4 Active and 3 Deleted
>
> Classics: 1 Active and 3 Deleted
>
> GIFs: 2 Deleted Gifs
>
> Number of NTFS Image Partitions: 1
>
> Number of NTFS Active and Deleted files: 2 Active and 5 Deleted

6 References
============

\[1\] https://en.wikipedia.org/wiki/Design\_of\_the\_FAT\_file\_system

