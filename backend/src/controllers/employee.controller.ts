// src/controllers/employee.controller.ts
// ─────────────────────────────────────────────
// EMPLOYEE CONTROLLER
// ─────────────────────────────────────────────

import { Request, Response } from 'express'
import * as employeeService from '../services/employee.service'


export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await employeeService.createEmployee(
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(201).json(employee)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('limit') || message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, departmentId, employmentType, search, nationality, page, pageSize } = req.query
    const result = await employeeService.listEmployees(req.user!.tenantId, {
      status: status as any,
      departmentId: departmentId as string,
      employmentType: employmentType as any,
      search: search as string,
      nationality: nationality as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    })
    res.status(200).json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await employeeService.getEmployeeById(
      req.params.employeeId as string,
      req.user!.tenantId
    )
    res.status(200).json(employee)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getWithRecords = async (req: Request, res: Response): Promise<void> => {
  try {
    const employee = await employeeService.getEmployeeWithRecords(
      req.params.employeeId as string,
      req.user!.tenantId
    )
    res.status(200).json(employee)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await employeeService.updateEmployee(
      req.params.employeeId as string,
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const terminate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { endDate, reason } = req.body
    if (!endDate) {
      res.status(400).json({ error: 'endDate is required' })
      return
    }
    const updated = await employeeService.terminateEmployee(
      req.params.employeeId as string,
      req.user!.tenantId,
      req.user!.userId,
      { endDate: new Date(endDate), reason }
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('already terminated')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body
    if (!status) {
      res.status(400).json({ error: 'Status is required' })
      return
    }
    const updated = await employeeService.updateEmployeeStatus(
      req.params.employeeId as string,
      req.user!.tenantId,
      req.user!.userId,
      status
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getExpirySnapshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const withinDays = req.query.withinDays ? parseInt(req.query.withinDays as string) : 90
    const snapshot = await employeeService.getExpirySnapshot(req.user!.tenantId, withinDays)
    res.status(200).json(snapshot)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Departments ──

export const listDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await employeeService.listDepartments(req.user!.tenantId)
    res.status(200).json(departments)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body
    if (!name) {
      res.status(400).json({ error: 'Department name is required' })
      return
    }
    const dept = await employeeService.createDepartment(
      req.user!.tenantId,
      req.user!.userId,
      { name, description }
    )
    res.status(201).json(dept)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('already exists')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await employeeService.updateDepartment(
      req.params.departmentId as string,
      req.user!.tenantId,
      req.user!.userId,
      req.body
    )
    res.status(200).json(updated)
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    await employeeService.deleteDepartment(
      req.params.departmentId as string,
      req.user!.tenantId,
      req.user!.userId
    )
    res.status(200).json({ message: 'Department deleted' })
  } catch (err) {
    const message = (err as Error).message
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
      return
    }
    if (message.includes('assigned employee')) {
      res.status(409).json({ error: message })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}