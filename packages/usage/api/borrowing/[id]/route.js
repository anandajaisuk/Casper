import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const borrowing = await prisma.borrowing.findUnique({
      where: { id: parseInt(id) },
    include: {
      user: true,
      book: true
    }
    })
   
    if (!borrowing) {
      return NextResponse.json(
        { error: 'Borrowing not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(borrowing)
  } catch (error) {
    console.error('Failed to fetch borrowing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch borrowing' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingBorrowing = await prisma.borrowing.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingBorrowing) {
      return NextResponse.json(
        { error: 'Borrowing not found' },
        { status: 404 }
      )
    }

    const data = await req.json()
   
    const updatedBorrowing = await prisma.borrowing.update({
      where: { id: parseInt(id) },
      data,
      include: {
        user: true,
        book: true
      }
    })
   
    return NextResponse.json(updatedBorrowing)
  } catch (error) {
    console.error('Failed to update borrowing:', error)
    return NextResponse.json(
      { error: 'Failed to update borrowing', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingBorrowing = await prisma.borrowing.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingBorrowing) {
      return NextResponse.json(
        { error: 'Borrowing not found' },
        { status: 404 }
      )
    }
   
    

    await prisma.borrowing.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'Borrowing deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete borrowing:', error)
    return NextResponse.json(
      { error: 'Failed to delete borrowing', details: error.message },
      { status: 500 }
    )
  }
}