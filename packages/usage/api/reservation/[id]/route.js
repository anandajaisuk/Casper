import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req, { params }) {
  try {
    const { id } = await params
    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
    include: {
      user: true,
      book: true
    }
    })
   
    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(reservation)
  } catch (error) {
    console.error('Failed to fetch reservation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params
    
    const existingReservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingReservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    const data = await req.json()
   
    const updatedReservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data,
      include: {
        user: true,
        book: true
      }
    })
   
    return NextResponse.json(updatedReservation)
  } catch (error) {
    console.error('Failed to update reservation:', error)
    return NextResponse.json(
      { error: 'Failed to update reservation', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existingReservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existingReservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }
   
    

    await prisma.reservation.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: 'Reservation deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete reservation:', error)
    return NextResponse.json(
      { error: 'Failed to delete reservation', details: error.message },
      { status: 500 }
    )
  }
}