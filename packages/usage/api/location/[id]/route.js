import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) },
    include: {
      books: true
    }
    })
   
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(location)
  } catch (error) {
    console.error('Failed to fetch location:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingLocation = await prisma.location.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    const data = await req.json()
   
    const updatedLocation = await prisma.location.update({
      where: { id: parseInt(id) },
      data,
      include: {
        books: true
      }
    })
   
    return NextResponse.json(updatedLocation)
  } catch (error) {
    console.error('Failed to update location:', error)
    return NextResponse.json(
      { error: 'Failed to update location', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingLocation = await prisma.location.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }
   
    

    await prisma.location.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'Location deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete location:', error)
    return NextResponse.json(
      { error: 'Failed to delete location', details: error.message },
      { status: 500 }
    )
  }
}