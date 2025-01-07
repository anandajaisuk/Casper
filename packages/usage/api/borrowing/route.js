import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req) {
  try {
    const borrowings = await prisma.borrowing.findMany({
    include: {
      user: true,
      book: true
    }
    })
    return NextResponse.json(borrowings)
  } catch (error) {
    console.error('Failed to fetch borrowings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch borrowings' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    const newBorrowing = await prisma.borrowing.create({
      data,
      include: {
        user: true,
        book: true
      }
    })
    return NextResponse.json(newBorrowing, { status: 201 })
  } catch (error) {
    console.error('Failed to create borrowing:', error)
    return NextResponse.json(
      { error: 'Failed to create borrowing', details: error.message },
      { status: 500 }
    )
  }
}