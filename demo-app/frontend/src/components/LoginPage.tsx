import { Activity, Shield, TrendingUp, Zap } from 'lucide-react'

export default function LoginPage() {
  const handleWhoopLogin = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = '/auth/whoop'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-whoop-red rounded-full flex items-center justify-center">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">
            Whoop Demo App
          </h1>
          <p className="text-gray-400 text-lg">
            Connect your Whoop account to view your fitness and recovery data
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 py-8">
          <div className="flex items-center space-x-3 text-gray-300">
            <TrendingUp className="w-5 h-5 text-whoop-green" />
            <span>View your recovery trends</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-300">
            <Zap className="w-5 h-5 text-whoop-yellow" />
            <span>Track your daily strain</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-300">
            <Shield className="w-5 h-5 text-whoop-red" />
            <span>Secure OAuth authentication</span>
          </div>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          <button
            onClick={handleWhoopLogin}
            className="w-full bg-whoop-red hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <Activity className="w-5 h-5" />
            <span>Connect with Whoop</span>
          </button>
          
          <p className="text-sm text-gray-500">
            You'll be redirected to Whoop to authorize this application
          </p>
        </div>

        {/* Footer */}
        <div className="pt-8 text-center">
          <p className="text-xs text-gray-600">
            This demo app showcases the Whoop SDK capabilities.
            <br />
            Your data is processed securely and not stored permanently.
          </p>
        </div>
      </div>
    </div>
  )
} 