import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import ClientsPage from './pages/ClientsPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </main>
    </div>
  )
}
