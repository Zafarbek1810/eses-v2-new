import { useState, useCallback } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CircleDot,
  ClipboardList,
  DoorOpen,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react'

const API_URL = '/api/access-events'

function formatTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatToday() {
  return new Date().toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getStatusClass(item) {
  if (item.attendanceStatus === 'checkIn') return 'checkin'
  if (item.attendanceStatus === 'checkOut') return 'checkout'
  return 'unknown'
}

function getStatusIcon(item) {
  if (item.attendanceStatus === 'checkIn') return <ArrowUpRight size={12} />
  if (item.attendanceStatus === 'checkOut') return <ArrowDownLeft size={12} />
  return <CircleDot size={12} />
}

function getStatusLabel(item) {
  if (item.label) return item.label
  if (item.attendanceStatus === 'checkIn') return 'Kirish'
  if (item.attendanceStatus === 'checkOut') return 'Chiqish'
  return 'Tashrif'
}

function PhotoModal({ url, name, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Yopish">
          <X size={16} />
        </button>
        <img src={url} alt={name} className="modal-img" />
      </div>
    </div>
  )
}

function EventCard({ item, onPhotoClick }) {
  const statusClass = getStatusClass(item)
  const statusLabel = getStatusLabel(item)

  return (
    <div className={`event-card ${statusClass}`}>
      <div className="event-card-top">
        <div className="event-avatar">
          {item.pictureURL ? (
            <img
              src={item.pictureURL}
              alt={item.name}
              className="event-photo event-photo-clickable"
              onClick={() => onPhotoClick(item.pictureURL, item.name)}
              onError={e => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="event-photo event-photo-placeholder">
              <User size={28} />
            </div>
          )}
          <div className={`event-status-badge ${statusClass}`}>
            {getStatusIcon(item)}
          </div>
        </div>

        <div className="event-main">
          <div className="event-name" title={item.name || "(Ism yo'q)"}>
            {item.name || "(Ism yo'q)"}
          </div>
          <div className="event-time">
            <Calendar size={14} />
            {formatTime(item.time)}
          </div>
          <span className={`event-label ${statusClass}`}>
            {getStatusIcon(item)}
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="event-card-bottom">
        <div className="event-meta-item">
          <span className="event-meta-label">Xodim ID</span>
          <span className="event-meta-value">#{item.employeeNoString || '—'}</span>
        </div>
        <div className="event-meta-item">
          <span className="event-meta-label">Eshik</span>
          <span className="event-meta-value">#{item.doorNo ?? '—'}</span>
        </div>
        <div className="event-meta-item">
          <span className="event-meta-label">Karta turi</span>
          <span className="event-meta-value">
            {item.cardType === 1 ? 'IC Karta' : `#${item.cardType}`}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, value, label, colorClass }) {
  return (
    <div className="stat-card">
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className={`stat-icon ${colorClass}`}>
        <Icon size={20} />
      </div>
    </div>
  )
}

function defaultDateRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const pad = n => String(n).padStart(2, '0')
  const toLocal = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T00:00`,
    end: toLocal(now),
  }
}

export default function App() {
  const initialRange = defaultDateRange()
  const [startTime, setStartTime] = useState(initialRange.start)
  const [endTime, setEndTime] = useState(initialRange.end)
  const [maxResults, setMaxResults] = useState(30)
  const [searchPos, setSearchPos] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [modalUrl, setModalUrl] = useState(null)
  const [modalName, setModalName] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)

    const toTZ = dt => {
      const withSeconds = dt.length === 16 ? `${dt}:00` : dt
      return `${withSeconds}+05:00`
    }

    const body = {
      startTime: toTZ(startTime),
      endTime: toTZ(endTime),
      maxResults: Number(maxResults),
      searchResultPosition: Number(searchPos),
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let detail = ''
        try {
          const errJson = await res.json()
          detail = errJson?.error || errJson?.errorMsg || errJson?.subStatusCode || JSON.stringify(errJson)
        } catch (_) {}
        throw new Error(`Server xatosi ${res.status}: ${detail || res.statusText}`)
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message || "Noma'lum xato")
    } finally {
      setLoading(false)
    }
  }, [startTime, endTime, maxResults, searchPos])

  const infoList = data?.AcsEvent?.InfoList ?? []
  const totalMatches = data?.AcsEvent?.totalMatches ?? 0

  const checkIns = infoList.filter(i => i.attendanceStatus === 'checkIn').length
  const checkOuts = infoList.filter(i => i.attendanceStatus === 'checkOut').length
  const others = infoList.length - checkIns - checkOuts

  const filtered = infoList.filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (item.name || '').toLowerCase().includes(q)
      || (item.employeeNoString || '').includes(q)
    )
  })

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <header className="header">
          <div className="header-brand">
            <div className="header-logo">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="header-eyebrow">
                <ShieldCheck size={14} />
                SES HR
              </div>
              <div className="header-title">Davomat nazorati</div>
              <div className="header-subtitle">
                Hikvision kirish nazorati · {formatToday()}
              </div>
            </div>
          </div>
          <div className="header-badge">
            <div className="header-badge-dot" />
            Onlayn
          </div>
        </header>

        <div className="panel">
          <div className="panel-title">
            <Search size={18} />
            Hodisalarni qidirish
          </div>
          <div className="filter-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="start-time">Boshlanish vaqti</label>
              <input
                id="start-time"
                type="datetime-local"
                className="form-input"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="end-time">Tugash vaqti</label>
              <input
                id="end-time"
                type="datetime-local"
                className="form-input"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="max-results">Max natija</label>
              <input
                id="max-results"
                type="number"
                className="form-input"
                value={maxResults}
                min={1}
                max={1000}
                onChange={e => setMaxResults(e.target.value)}
                style={{ width: 100 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={fetchEvents}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Yuklanmoqda…
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Qidirish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>
              <div className="error-title">Kamera bilan bog&apos;lanib bo&apos;lmadi</div>
              <div className="error-msg">{error}</div>
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="stats-row">
            <StatCard icon={ClipboardList} value={totalMatches} label="Jami hodisalar" colorClass="teal" />
            <StatCard icon={LogIn} value={checkIns} label="Kirish" colorClass="green" />
            <StatCard icon={LogOut} value={checkOuts} label="Chiqish" colorClass="red" />
            <StatCard icon={Zap} value={others} label="Boshqa" colorClass="purple" />
          </div>
        )}

        {loading && (
          <div className="spinner-wrapper">
            <div className="spinner" />
            <div className="spinner-text">Ma&apos;lumotlar yuklanmoqda…</div>
          </div>
        )}

        {!loading && data && (
          <div className="events-section">
            <div className="section-header">
              <h2 className="section-title">
                <DoorOpen size={20} />
                Kirish hodisalari
                <span className="section-count">{filtered.length} ta</span>
              </h2>

              <div className="search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  id="search-input"
                  type="text"
                  className="form-input search-input"
                  placeholder="Ism yoki ID bo'yicha qidirish…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <ClipboardList size={24} />
                </div>
                <div className="empty-title">Hodisa topilmadi</div>
                <div className="empty-desc">
                  {searchQuery
                    ? 'Qidiruv natijasida hech narsa topilmadi'
                    : "Tanlangan vaqt oralig'ida hodisa mavjud emas"}
                </div>
              </div>
            ) : (
              <div className="events-grid">
                {filtered.map((item, idx) => (
                  <EventCard
                    key={item.serialNo ?? idx}
                    item={item}
                    onPhotoClick={(url, name) => {
                      setModalUrl(url)
                      setModalName(name)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !data && !error && (
          <div className="empty-state">
            <div className="empty-icon">
              <Sparkles size={24} />
            </div>
            <div className="empty-title">
              Ma&apos;lumotlarni yuklash uchun &quot;Qidirish&quot; tugmasini bosing
            </div>
            <div className="empty-desc">
              Sana oralig&apos;ini tanlang va hodisalarni ko&apos;ring
            </div>
          </div>
        )}
      </div>

      {modalUrl && (
        <PhotoModal
          url={modalUrl}
          name={modalName}
          onClose={() => {
            setModalUrl(null)
            setModalName('')
          }}
        />
      )}
    </div>
  )
}
