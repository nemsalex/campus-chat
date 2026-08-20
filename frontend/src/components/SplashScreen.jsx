import { GraduationCap } from 'lucide-react'
import './SplashScreen.css'

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-logo"><GraduationCap size={40} /></div>
      <h1>Campus Chat</h1>
      <div className="splash-dots">
        <span /><span /><span />
      </div>
    </div>
  )
}

export default SplashScreen
