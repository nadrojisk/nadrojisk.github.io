3 NTFS Image
============

Using the same method, we used on the FAT volume we can find the
partition sector offset and what partition type it is.

1.  **First Sector: Offset 0x01C6 = 0x0800 = 2048**

2.  **First Sector Address: 512 \* 2048 = 1,048,576 = 0x100000**

3.  Partition ID: Offset 0x01C2 = 0x07 = 7 = NTFS

![](media/image27.png){width="6.5in" height="6.400695538057743in"}

We now know the NTFS partition offset. We will use it later for
recovering the files. However, we will not use the raw image in disk
editor, due to the large offsets, we will use the partition view
instead. Here we can grab the following information:

a.  **Bytes/Sector: Offset 0x0B = 0x0200 = 512**

b.  **Sectors/Cluster: Offset 0x0D = 0x08 = 8**

c.  **Bytes/Cluster: 8 \* 512 = 4096 bytes / cluster**

d.  **\$MFT Cluster Number: Offset 0x30 = 0x1380 = 4,992**

e.  **\$MFT Address: 0x13800000 = 20,447,232**

![C:\\Users\\gnpin\\AppData\\Local\\Packages\\Microsoft.Office.Desktop\_8wekyb3d8bbwe\\AC\\INetCache\\Content.MSO\\9F010F32.tmp](media/image28.png){width="5.048009623797025in"
height="4.970889107611549in"}

[]{#_Toc2965004 .anchor}Figure 24 - NTFS MBR using FTK Imager

Now that we know where the Master File Table is located, we can find the
number of system files, the system files length, and the start of the
user files. To find the start of the user files, we simply add the \$MFT
Address to the system files length. We know that there are normally
thirty-nine system files, so if we calculate the number of bytes for
those system files we get that the system files take up 39,936 bytes
(0x9C00) since each MFT entry is 1024 bytes. Adding that to the \$MFT
offset, 20,447,232 (0x1380000) we get that the user files start at
**20,487,168 (0x1389C00)**. Each file entry should have at least the
following file attributes

-   \$STANDARD\_INFORMATION (0x10)

-   \$FILE\_NAME (0x30)

-   \$DATA (0x80)

![](media/image29.png){width="6.267439851268591in"
height="4.86262467191601in"}

Jumping to offset 0x1389C00 we get the first user file.

1.  A Tale of Two Cities

    a.  List File Attributes:  

        i.  0x10 - \$STANDARD\_INFORMATION  

        ii. 0x30 - \$FILE\_NAME 

        iii. 0x80 - \$DATA 

        iv. 0xB0 - \$BITMAP

    b.  **Filename: Offset 0x0F2 = A Tale of Two Cities.pdf**

```{=html}
<!-- -->
```
c.  **Allocated Size: Offset 0x150= 0x150000 = 1,376,256 bytes**

d.  **Deleted**

e.  **Data Start Cluster: Offset 0x170 = 0x0588 = 1,416**

    i.  **Data Start Address**

        1.  **1,416 \* 4,096 = 5,799,936**

    ii. Actual Offset

        1.  Partition Offset + Start Address

        2.  1,048,576 + **5,799,936**= 6,848,512

f.  However, this file is fragmented, as seen by the multiple starting
    clusters. It cannot be recovered using the standard recovery method
    that we have been using

g.  Fragmented

![](media/image30.png){width="4.490181539807524in"
height="4.983333333333333in"}

2.  Auburn 

    a.  List File Attributes:  

        i.  0x10 - \$STANDARD\_INFORMATION  

        ii. 0x30 - \$FILE\_NAME 

        iii. 0x80 - \$DATA 

    b.  Filename: Offset 0x0F2 = Auburn.jpg 

    c.  Active

    d.  Allocated Size: Offset 0x130 = 0x4000 = 16,384 bytes 

    e.  Data Cluster Information 

        i.  **21 04 CB 06**

            1.  2 bytes required for the first cluster address 

            2.  Number of continuous clusters for this file -- 1 \* 4 =
                4 

            3.  Start Cluster for Data: 0x06CB = 1,739 

            4.  Start Address for Data: 

                a.  1,739 \* 4096 = 7,122,944 

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 7,122,944 = 8,171,520

![](media/image31.png){width="6.5in" height="4.480555555555555in"}

3.  **Avengers -- Offset 0x138A3C0 (20,489,216)**

    a.  **List File Attributes:**

        i.  **0x10 - \$STANDARD\_INFORMATION**

        ii. **0x30 - \$FILE\_NAME**

        iii. **0x80 - \$DATA**

    b.  **Filename: Offset 0x0F2 = Avengers.docx**

    c.  **Deleted**

    d.  **Allocated Size: Offset 0x138 = 0x100000 = 65,536 bytes**

    e.  **Data Cluster Information**

        i.  **21 0D CF 06**

            1.  2 bytes required for the first cluster address

            2.  Number of continuous clusters for this file -- 1 \* D =
                13

            3.  Start Cluster for Data: 0x06CF = 1,743

            4.  Start Address for Data:

                a.  1,739 \* 4096 = 7,139,328

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 7,139,328 = 8,187,904

    f.  Fragmented

![](media/image32.png){width="6.034885170603674in"
height="5.091609798775153in"}

4.  **Banana -- Offset 0x138A800 (20,490,240)**

    a.  **List File Attributes:**

        i.  **0x10 - \$STANDARD\_INFORMATION**

        ii. **0x30 - \$FILE\_NAME**

        iii. **0x80 - \$DATA**

        iv. **0xB0 - \$BITMAP**

    b.  **Filename: Offset 0x0F2 = Banana.gif**

    c.  **Deleted**

    d.  **Allocated Size: Offset 0x130 = 0x048000= 294,912 bytes**

    e.  **Data Cluster Information**

        i.  **21 48 DD 06**

            1.  2 bytes required for the first cluster address

            2.  Number of continuous clusters for this file -- 0x1 \*
             | 0x48 = 72

            3.  Start Cluster for Data: 0x06DD = 1,757

            4.  Start Address for Data

                a.  1,757 \* 4096 = 7,196,672

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 7,196,672 = 8,245,248

![](media/image33.png){width="4.709880796150482in"
height="5.249305555555556in"}

4.  **Great Expectations -- Offset 0x138AC00 (20,491,264)**

    a.  **List File Attributes:**

        i.  **0x10 - \$STANDARD\_INFORMATION**

        ii. **0x30 - \$FILE\_NAME**

        iii. **0x80 - \$DATA**

        iv. **0xB0 - \$BITMAP**

    b.  **Filename: Offset 0x0F2 = Great Expectations.pdf**

    c.  **Deleted**

    d.  **Allocated Size: Offset 0x148 = 0x310000= 3,211,264 bytes**

    e.  **Data Cluster Information**

        i.  **21 03 86 0A**

            1.  2 bytes required for the first cluster address

            2.  Number of continuous clusters for this file -- 0x1 \*
             | 0x3 = 3

            3.  Start Cluster for Data: 0x0A86 = 2,694

            4.  Start Address for Data:

                a.  2,694 \* 4096 = 11,034,624

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 11,034,624 = 12,083,200

    f.  Fragmented

![](media/image34.png){width="5.154861111111111in"
height="5.154861111111111in"}

5.  **Minion -- Offset 0x138B000 (20,492,288)**

    a.  **List File Attributes:**

        i.  **0x10 - \$STANDARD\_INFORMATION**

        ii. **0x30 - \$FILE\_NAME**

        iii. **0x80 - \$DATA**

        iv. **0x80 - \$BITMAP**

    b.  **Filename: Offset 0x0F2 = Minion.gif**

    c.  **Allocated Size: Offset 0x130 = 0x051000 = 331,776 bytes**

    d.  **Deleted**

    e.  **Data Cluster Information**

        i.  **21 05 31 0A**

            1.  2 bytes required for the first cluster address

            2.  Number of continuous clusters for this file -- 0x1 \*
             | 0x5 = 5

            3.  Start Cluster for Data: 0x0A31 = 2,609

            4.  Start Address for Data:

                a.  2,609 \* 4096 = 10,686,464

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 10,686,464 = 11,735,040

![](media/image35.png){width="5.118646106736658in"
height="5.039349300087489in"}

6.  **War and Peace -- Offset 0x138B000 (20,492,288)**

    a.  **List File Attributes:**

        i.  **0x10 - \$STANDARD\_INFORMATION**

        ii. **0x30 - \$FILE\_NAME**

        iii. **0x80 - \$DATA**

        iv. **0x80 - \$BITMAP**

    b.  **Filename: Offset 0x0F2 = War and Peace.pdf**

    c.  **Active**

    d.  **Allocated Size: Offset 0x140 = 0x9C0000 = 10,223,616 bytes**

    e.  **Data Cluster Information**

        i.  **22 90 08 E0 1A**

            1.  2 bytes required for the first cluster address

            2.  2 bytes required for cluster counter

                a.  0x0890 = 2,192

            3.  Start Cluster for Data: 0x1AE0 = 6,880

            4.  Start Address for Data:

                a.  6,880 \* 4096 = 28,180,480

            5.  Actual Offset

                a.  Partition Offset + Start Address

                b.  1,048,576 + 28,180,480 = 29,229,056

![](media/image36.png){width="4.726087051618547in"
height="4.699326334208224in"}

**Using the information gathered we can make a table similar to the ones
we used for the FAT partitions. However, this time clusters are not
subtracted by two. Note that some of these files are fragmented and
cannot be recovered in the same process we have been using so we will
have to use sleuth kit instead.**

  **Filename**               **Cluster**   **File Length**   **Cluster Offset**   **Actual Offset**   **Command To Retrieve File**                                                                        **Recoverable with DD**
  -------------------------- ------------- ----------------- -------------------- ------------------- --------------------------------------------------------------------------------------------------- -------------------------
  A Tale of Two Cities.pdf   1,416         1,376,256         5,799,936            6,848,512           sudo dd if=fat.dd of=\'A Tale of Two Cities.pdf\' bs=1 skip=6848512 count=1376256 status=progress    
  Auburn.jpg                 1,739         16,384            7,122,944            8,171,520           sudo dd if=fat.dd of=\'Auburn.jpg\' bs=1 skip=8171520 count=16384 status=progress                   X
  Avengers.docx              1,743         65,536            7,139,328            8,187,904           sudo dd if=fat.dd of=\'Avengers.docx\' bs=1 skip=8187904 count=65536 status=progress                 
  Banana.gif                 1,757         294,912           7,196,672            8,245,248           sudo dd if=fat.dd of=\'Banana.gif\' bs=1 skip=8245248 count=294912 status=progress                  X
  Great Expectations.pdf     2,694         3,211,264         11,034,624           12,083,200          sudo dd if=fat.dd of=\'Great Expectations.pdf\' bs=1 skip=12083200 count=3211264 status=progress     
  Minion.gif                 2,609         331,776           10,686,464           11,735,040          sudo dd if=fat.dd of=\'Minion.gif\' bs=1 skip=11735040 count=331776 status=progress                 X
  War and Peace.pdf          6,880         10,223,616        28,180,480           29,229,056          sudo dd if=fat.dd of=\'War and Peace.pdf\' bs=1 skip=29229056 count=10223616 status=progress        X

[]{#_Toc2965335 .anchor}Table 7 - NTFS File Recovery

![](media/image37.png){width="4.734043088363954in"
height="4.634911417322835in"}Using sleuth kit we can recover the files.
However, similar to before we will need the inodes of these files first.
To gather them we will need to run fls -o 2048 ntfs.dd.

With the inodes we can now attempt to recover the files. We can use icat
to recover these files.

icat -o 2048 -r ntfs.dd \[inode\] \> \[filename\]

-   icat -o 2048 -r ntfs.dd 39-128-1 \> 'A Tale of Two Cities.pdf'

-   icat -o 2048 -r ntfs.dd 41-128-1 \> 'Avengers.docx'

-   icat -o 2048 -r ntfs.dd 43-128-1 \> 'Great Expectations.pdf'
