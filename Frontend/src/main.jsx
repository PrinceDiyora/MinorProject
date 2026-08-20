import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom"
import './index.css'
import App from './App.jsx'
import LandingPage from './Components/LandingPage.jsx'
import LoginPage from './Components/LoginPage.jsx'
import RegisterPage from './Components/RegisterPage.jsx'
import DashboardLayout from './Components/Dashboard/DashboardLayout.jsx'
import Dashboard from './Components/Dashboard/Dashboard.jsx'
import MenuMatrix from './Components/Dashboard/MenuMatrix.jsx'
import ComboEngine from './Components/Dashboard/ComboEngine.jsx'
import PriceOptimizer from './Components/Dashboard/PriceOptimizer.jsx'
import OrderDetails from './Components/Dashboard/OrderDetails.jsx'
import MenuManagement from './Components/Dashboard/MenuManagement.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "dashboard",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "menu", element: <MenuMatrix /> },
          { path: "combos", element: <ComboEngine /> },
          { path: "pricing", element: <PriceOptimizer /> },
          { path: "orders", element: <OrderDetails /> },
          { path: "manage-menu", element: <MenuManagement /> }
        ]
      }
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
