import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import crypto from 'crypto'
import path from 'path'

const prisma = new PrismaClient()

async function saveFile(file, folderName) {
    const uploadDir = path.join(process.cwd(), "public", folderName);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const randomId = crypto.randomUUID();
    const fileExtension = path.extname(file.name);
    const newFileName = `${randomId}${fileExtension}`;
    const filePath = path.join(uploadDir, newFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFileSync(filePath, buffer);

    return `/${folderName}/${newFileName}`;
}


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    include: {
      borrowings: true,
      reservations: true
    }
    })
   
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    
    // Check content type to determine if it's form data
    const contentType = req.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      data = {};

      // Process file uploads
      
      const avatarFile = formData.get("avatar");
      if (avatarFile && avatarFile.name) {
        // Delete old file if it exists
        if (existingUser.avatar) {
          const oldFilePath = path.join(process.cwd(), "public", existingUser.avatar);
          try {
            await fs.unlinkSync(oldFilePath);
          } catch (error) {
            console.error('Failed to delete old file:', error);
          }
        }
        data.avatar = await saveFile(avatarFile, "useravatars");
      }
      
      // Process other fields
      for (const [key, value] of formData.entries()) {
        if (!key.startsWith("avatar")) {
          try {
            // Try to parse JSON fields
            data[key] = JSON.parse(value);
          } catch {
            // If not JSON, use the value as is
            data[key] = value;
          }
        }
      }
    } else {
      data = await req.json();
    }
   
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      include: {
        borrowings: true,
        reservations: true
      }
    })
   
    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
   
    
    // Delete associated files
    
    if (existingUser.avatar) {
      const filePath = path.join(process.cwd(), "public", existingUser.avatar);
      try {
        await fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    )
  }
}