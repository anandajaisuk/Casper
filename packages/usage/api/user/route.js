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


export async function GET(req) {
  try {
    const users = await prisma.user.findMany({
    include: {
      borrowings: true,
      reservations: true
    }
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    
    // Process file uploads
    const data = {};
    
    const avatarFile = formData.get("avatar");
    if (avatarFile && avatarFile.name) {
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

    const newUser = await prisma.user.create({
      data,
      include: {
        borrowings: true,
        reservations: true
      }
    })
    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    )
  }
}