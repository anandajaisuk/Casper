import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req) {
  try {
    const books = await prisma.book.findMany({
    include: {
      category: true,
      location: true,
      borrowings: true,
      reservations: true
    }
    })
    return NextResponse.json(books)
  } catch (error) {
    console.error('Failed to fetch books:', error)
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    const newBook = await prisma.book.create({
      data,
      include: {
        category: true,
        location: true,
        borrowings: true,
        reservations: true
      }
    })
    return NextResponse.json(newBook, { status: 201 })
  } catch (error) {
    console.error('Failed to create book:', error)
    return NextResponse.json(
      { error: 'Failed to create book', details: error.message },
      { status: 500 }
    )
  }
}