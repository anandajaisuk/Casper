import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'


const prisma = new PrismaClient()


export async function GET(req) {
  try {
    const reservations = await prisma.reservation.findMany({
    include: {
      user: true,
      book: true
    }
    })
    return NextResponse.json(reservations)
  } catch (error) {
    console.error('Failed to fetch reservations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const data = await req.json()

    const newReservation = await prisma.reservation.create({
      data,
      include: {
        user: true,
        book: true
      }
    })
    return NextResponse.json(newReservation, { status: 201 })
  } catch (error) {
    console.error('Failed to create reservation:', error)
    return NextResponse.json(
      { error: 'Failed to create reservation', details: error.message },
      { status: 500 }
    )
  }
}