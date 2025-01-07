import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req) {
  try {
    const categorys = await prisma.category.findMany({
    include: {
      books: true
    }
    })
    return NextResponse.json(categorys)
  } catch (error) {
    console.error('Failed to fetch categorys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categorys' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    const newCategory = await prisma.category.create({
      data,
      include: {
        books: true
      }
    })
    return NextResponse.json(newCategory, { status: 201 })
  } catch (error) {
    console.error('Failed to create category:', error)
    return NextResponse.json(
      { error: 'Failed to create category', details: error.message },
      { status: 500 }
    )
  }
}