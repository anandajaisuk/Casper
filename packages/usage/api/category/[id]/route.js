import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
    include: {
      books: true
    }
    })
   
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(category)
  } catch (error) {
    console.error('Failed to fetch category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    const data = await req.json()
   
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(id) },
      data,
      include: {
        books: true
      }
    })
   
    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error('Failed to update category:', error)
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }
   
    

    await prisma.category.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'Category deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category', details: error.message },
      { status: 500 }
    )
  }
}