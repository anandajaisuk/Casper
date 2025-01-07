import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req) {
  try {
    const locations = await prisma.location.findMany({
    include: {
      books: true
    }
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error('Failed to fetch locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    const newLocation = await prisma.location.create({
      data,
      include: {
        books: true
      }
    })
    return NextResponse.json(newLocation, { status: 201 })
  } catch (error) {
    console.error('Failed to create location:', error)
    return NextResponse.json(
      { error: 'Failed to create location', details: error.message },
      { status: 500 }
    )
  }
}