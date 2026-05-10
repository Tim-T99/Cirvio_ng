import { Request, Response } from 'express'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})


// ====COMPANIES====

export const createCompany = async (req: Request, res: Response) => {
  const { companyName, sector, email, phone, address, location, website, contact_name, contact_email, contact_phone } = req.body

  try {
    const result = await pool.query(
      `INSERT INTO companies (name, sector, email, phone, address, location, website, contact_name, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [companyName, sector, email, phone, address, location, website, contact_name, contact_email, contact_phone]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Failed to create company' })
  }
}

export const getCompany = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await pool.query(`SELECT * FROM companies WHERE id = $1`, [id])
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Company not found' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error fetching company' })
  }
}

export const getAllCompanies = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM companies`)
    res.status(200).json({ success: true, data: result.rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error fetching companies' })
  }
}

export const updateCompany = async (req: Request, res: Response) => {
  const { id } = req.params
  const { companyName, sector, email, phone, address, location, website, contact_name, contact_email, contact_phone } = req.body
  try {
    const result = await pool.query(
      `UPDATE companies SET name=$1, sector=$2, email=$3, phone=$4, address=$5, location=$6, website=$7, contact_name=$8, contact_email=$9, contact_phone=$10
       WHERE id=$11 RETURNING *`,
      [companyName, sector, email, phone, address, location, website, contact_name, contact_email, contact_phone, id]
    )
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Company not found' })
      return
    }
    res.status(200).json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error updating company' })
  }
}

export const deleteCompany = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await pool.query(`DELETE FROM companies WHERE id=$1 RETURNING *`, [id])
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Cannot find the company in your records' })
      return
    }
    res.status(200).json({ success: true, message: 'Company deleted successfully' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Server error deleting the company.' })
  }
}


// ====MANAGERS====

export const createManager = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const getManager = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const getAllManagers = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const updateManager = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const deleteManager = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}


// ====EMPLOYEES====

export const createEmployee = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const getEmployee = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const getAllEmployees = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const updateEmployee = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}

export const deleteEmployee = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented' })
}
