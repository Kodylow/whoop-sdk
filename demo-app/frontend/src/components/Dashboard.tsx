import { useEffect, useState } from 'react'
import { Activity, Heart, Moon, Dumbbell, User, LogOut, TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import LoadingSpinner from './LoadingSpinner'

interface UserProfile {
  user_id: number
  email: string
  first_name: string
  last_name: string
}

interface RecoveryScore {
  recovery_score: number
  resting_heart_rate: number
  hrv_rmssd_milli: number
  spo2_percentage?: number
  skin_temp_celsius?: number
}

interface Recovery {
  recovery?: {
    score?: RecoveryScore
    score_state: string
  }
  cycle: {
    id: number
    start: string
    end?: string
    score?: {
      strain: number
    }
  }
  status: {
    hasRecovery: boolean
    isCalibrating: boolean
    isScored: boolean
  }
}

interface RecoveryTrend {
  date: string
  recoveryScore: number | null
  strain: number | null
  isCalibrating: boolean
}

interface Sleep {
  id: number
  start: string
  end: string
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number
      total_awake_time_milli: number
      total_no_data_time_milli: number
      total_light_sleep_time_milli: number
      total_slow_wave_sleep_time_milli: number
      total_rem_sleep_time_milli: number
    }
    sleep_performance_percentage: number
    sleep_consistency_percentage: number
    sleep_efficiency_percentage: number
  }
}

interface Workout {
  id: number
  sport_id: number
  start: string
  end: string
  score?: {
    strain: number
    average_heart_rate: number
    max_heart_rate: number
    kilojoule: number
  }
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recovery, setRecovery] = useState<Recovery | null>(null)
  const [recoveryTrends, setRecoveryTrends] = useState<RecoveryTrend[]>([])
  const [sleep, setSleep] = useState<Sleep[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch all data in parallel
      const [profileRes, recoveryRes, trendsRes, sleepRes, workoutsRes] = await Promise.all([
        fetch('/api/user/profile', { credentials: 'include' }),
        fetch('/api/user/recovery/current', { credentials: 'include' }),
        fetch('/api/user/recovery/trends?days=7', { credentials: 'include' }),
        fetch('/api/user/sleep?limit=5', { credentials: 'include' }),
        fetch('/api/user/workouts?limit=5', { credentials: 'include' })
      ])

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData)
      }

      if (recoveryRes.ok) {
        const recoveryData = await recoveryRes.json()
        setRecovery(recoveryData)
      }

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json()
        setRecoveryTrends(trendsData)
      }

      if (sleepRes.ok) {
        const sleepData = await sleepRes.json()
        setSleep(sleepData.records || [])
      }

      if (workoutsRes.ok) {
        const workoutsData = await workoutsRes.json()
        setWorkouts(workoutsData.records || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      // Reload page to reset auth state
      window.location.reload()
    } catch (err) {
      console.error('Error logging out:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error loading data</div>
          <button 
            onClick={fetchData}
            className="bg-whoop-red hover:bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const formatTime = (millis: number) => {
    const hours = Math.floor(millis / (1000 * 60 * 60))
    const minutes = Math.floor((millis % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const getRecoveryColor = (score: number) => {
    if (score >= 67) return 'text-whoop-green'
    if (score >= 34) return 'text-whoop-yellow'
    return 'text-whoop-red'
  }

  const getStrainColor = (strain: number) => {
    if (strain >= 18) return 'text-whoop-red'
    if (strain >= 14) return 'text-orange-500'
    if (strain >= 10) return 'text-whoop-yellow'
    return 'text-whoop-green'
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-whoop-red rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold">Whoop Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {profile?.first_name} {profile?.last_name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Recovery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {recovery?.status.hasRecovery && recovery?.recovery?.score ? (
            <>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Recovery</p>
                    <p className={`text-3xl font-bold ${getRecoveryColor(recovery.recovery.score.recovery_score)}`}>
                      {recovery.recovery.score.recovery_score}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-whoop-green" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Resting HR</p>
                    <p className="text-3xl font-bold text-white">
                      {recovery.recovery.score.resting_heart_rate}
                      <span className="text-lg text-gray-400"> bpm</span>
                    </p>
                  </div>
                  <Heart className="w-8 h-8 text-red-500" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">HRV</p>
                    <p className="text-3xl font-bold text-white">
                      {recovery.recovery.score.hrv_rmssd_milli.toFixed(1)}
                      <span className="text-lg text-gray-400"> ms</span>
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Strain</p>
                    <p className={`text-3xl font-bold ${recovery.cycle.score?.strain ? getStrainColor(recovery.cycle.score.strain) : 'text-gray-400'}`}>
                      {recovery.cycle.score?.strain?.toFixed(1) || 'N/A'}
                    </p>
                  </div>
                  <Dumbbell className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-full bg-gray-800 rounded-lg p-6 text-center">
              <p className="text-gray-400">
                {recovery?.status.isCalibrating 
                  ? "🔄 Still calibrating - recovery data will be available soon"
                  : "No recovery data available"}
              </p>
            </div>
          )}
        </div>

        {/* Recovery Trends */}
        {recoveryTrends.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Recovery Trends (Last 7 Days)
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="space-y-3">
                {recoveryTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
                    <div className="text-sm text-gray-400">
                      {format(new Date(trend.date), 'MMM dd')}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className={`font-semibold ${trend.recoveryScore ? getRecoveryColor(trend.recoveryScore) : 'text-gray-500'}`}>
                          {trend.recoveryScore ? `${trend.recoveryScore}%` : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">Recovery</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${trend.strain ? getStrainColor(trend.strain) : 'text-gray-500'}`}>
                          {trend.strain ? trend.strain.toFixed(1) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">Strain</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sleep & Workouts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Sleep */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Moon className="w-5 h-5 mr-2" />
              Recent Sleep
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              {sleep.length > 0 ? (
                <div className="space-y-4">
                  {sleep.slice(0, 3).map((sleepRecord) => (
                    <div key={sleepRecord.id} className="border-b border-gray-700 pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-400">
                            {format(new Date(sleepRecord.start), 'MMM dd')}
                          </p>
                          {sleepRecord.score && (
                            <p className="text-lg font-semibold text-white">
                              {formatTime(sleepRecord.score.stage_summary.total_in_bed_time_milli)}
                            </p>
                          )}
                        </div>
                        {sleepRecord.score && (
                          <div className="text-right">
                            <p className="text-sm text-whoop-green">
                              {sleepRecord.score.sleep_performance_percentage}% Performance
                            </p>
                            <p className="text-xs text-gray-500">
                              {sleepRecord.score.sleep_efficiency_percentage}% Efficiency
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No recent sleep data</p>
              )}
            </div>
          </div>

          {/* Recent Workouts */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Dumbbell className="w-5 h-5 mr-2" />
              Recent Workouts
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              {workouts.length > 0 ? (
                <div className="space-y-4">
                  {workouts.slice(0, 3).map((workout) => (
                    <div key={workout.id} className="border-b border-gray-700 pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-400">
                            {format(new Date(workout.start), 'MMM dd')}
                          </p>
                          <p className="text-lg font-semibold text-white">
                            Sport ID: {workout.sport_id}
                          </p>
                        </div>
                        {workout.score && (
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${getStrainColor(workout.score.strain)}`}>
                              {workout.score.strain.toFixed(1)} Strain
                            </p>
                            <p className="text-xs text-gray-500">
                              Avg HR: {workout.score.average_heart_rate} bpm
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No recent workout data</p>
              )}
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchData}
            className="bg-whoop-red hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
          >
            <Activity className="w-4 h-4" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>
    </div>
  )
} 