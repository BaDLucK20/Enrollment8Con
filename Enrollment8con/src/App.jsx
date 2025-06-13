import { Routes, Route} from 'react-router-dom'
import UniversalDashboard from './components/Dashboard'
import LoginPage from './components/Login'
import PendingPayment from './components/PendingPayment'
import CompletedPayment from './components/CompletedPayment'
import PaymentHistory from './components/PaymentHistory'
import StudentForm from './components/AddStudent'
import StaffForm from './components/AddStaff'
import AddDocument from './components/AddDocument'
// import Logout from './components/Logout'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      {/* <Route path="/Logout" element={<Logout/>}/> */}
      <Route path="/PendingPayment" element={<PendingPayment/>} />
      <Route path="/CompletedPayment" element={<CompletedPayment/>} />
      <Route path="/PaymentHistory" element={<PaymentHistory/>} />
      <Route path="/AddStudent" element={<StudentForm/>} />
      <Route path="/AddStaff" element={<StaffForm/>} />
      <Route path="/AddDocument" element={<AddDocument/>} />
      <Route path="/Dashboard" element={<UniversalDashboard />} />

    </Routes>
  )
}

export default App
