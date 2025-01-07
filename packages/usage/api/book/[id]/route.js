import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const book = await prisma.book.findUnique({
      where: { id: parseInt(id) },
    include: {
      category: true,
      location: true,
      borrowings: true,
      reservations: true
    }
    })
   
    if (!book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(book)
  } catch (error) {
    console.error('Failed to fetch book:', error)
    return NextResponse.json(
      { error: 'Failed to fetch book' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingBook = await prisma.book.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingBook) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    const data = await req.json()
   
    const updatedBook = await prisma.book.update({
      where: { id: parseInt(id) },
      data,
      include: {
        category: true,
        location: true,
        borrowings: true,
        reservations: true
      }
    })
   
    return NextResponse.json(updatedBook)
  } catch (error) {
    console.error('Failed to update book:', error)
    return NextResponse.json(
      { error: 'Failed to update book', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingBook = await prisma.book.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingBook) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }
   
    

    await prisma.book.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'Book deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete book:', error)
    return NextResponse.json(
      { error: 'Failed to delete book', details: error.message },
      { status: 500 }
    )
  }
}