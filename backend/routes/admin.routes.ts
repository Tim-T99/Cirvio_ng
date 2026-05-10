import { Router } from 'express'
import {
  createCompany,
  getCompany,
  getAllCompanies,
  updateCompany,
  deleteCompany,
  createManager,
  getManager,
  getAllManagers,
  updateManager,
  deleteManager,
  createEmployee,
  getEmployee,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
} from '../controllers/adminControllers'

const router = Router()

// Companies
router.post('/companies', createCompany)
router.get('/companies', getAllCompanies)
router.get('/companies/:id', getCompany)
router.put('/companies/:id', updateCompany)
router.delete('/companies/:id', deleteCompany)

// Managers
router.post('/managers', createManager)
router.get('/managers', getAllManagers)
router.get('/managers/:id', getManager)
router.put('/managers/:id', updateManager)
router.delete('/managers/:id', deleteManager)

// Employees
router.post('/employees', createEmployee)
router.get('/employees', getAllEmployees)
router.get('/employees/:id', getEmployee)
router.put('/employees/:id', updateEmployee)
router.delete('/employees/:id', deleteEmployee)

export default router
