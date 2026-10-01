import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, Edit3, LoaderCircle, Plus, Send, Trash2, X } from 'lucide-react'
import profileCatalog from '../../../shared/profileCatalog.json'
import { archiveCampusJob, createCampusJob, getManagedCampusJobs, setCampusJobStatus, updateCampusJob, type CampusJobInput } from '../services/api'
import type { PlacementJob } from '../types/placement'
import ProfileMultiSelect from './ProfileMultiSelect'
import '../placement.css'

type DrivePage = 'list' | 'new' | 'detail'
type Props = { page?: DrivePage; driveId?: string | null; onNavigate: (path: string) => void; onOpenAnalytics: (jobId: string) => void }
const emptyJob = (): CampusJobInput => ({ companyName: '', role: '', jobDescription: '', ctc: '', ctcLpa: null, location: '', deadline: '', requiredSkills: [], eligibleBranches: [], minimumCgpa: null, maximumBacklogs: null, graduationYears: [], employmentType: '', additionalCriteria: '' })
const commaList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)

export default function TpoDriveManagement({ page = 'list', driveId, onNavigate, onOpenAnalytics }: Props) {
  const [jobs, setJobs] = useState<PlacementJob[]>([])
  const [form, setForm] = useState<CampusJobInput>(emptyJob)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const skills = useMemo(() => profileCatalog.skillCategories.map((category) => ({ name: category.name, options: category.skills })), [])
  const isEditor = page !== 'list'

  useEffect(() => { void (async () => { setLoading(true); try { setJobs(await getManagedCampusJobs()) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load campus drives.') } finally { setLoading(false) } })() }, [])
  useEffect(() => {
    if (page !== 'detail' || !driveId || editingId === driveId) return
    const job = jobs.find((item) => item.id === driveId)
    if (!job) { if (!loading) setError('That campus drive was not found.'); return }
    setEditingId(job.id)
    setForm({ companyName: job.companyName || '', role: job.role || '', jobDescription: job.jobDescription || '', ctc: job.ctc || '', ctcLpa: job.ctcLpa, location: job.location || '', deadline: job.deadline ? job.deadline.slice(0, 10) : '', requiredSkills: job.requiredSkills, eligibleBranches: job.eligibleBranches, minimumCgpa: job.minimumCgpa, maximumBacklogs: job.maximumBacklogs, graduationYears: job.graduationYears, employmentType: job.employmentType || '', additionalCriteria: job.additionalCriteria || '' })
  }, [page, driveId, jobs, loading, editingId])

  const save = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const job = editingId ? await updateCampusJob(editingId, form) : await createCampusJob(form)
      setJobs((items) => editingId ? items.map((item) => item.id === job.id ? job : item) : [job, ...items])
      setNotice(editingId ? 'Campus drive updated.' : 'Campus drive saved as a draft.')
      window.setTimeout(() => onNavigate('/tpo/drives'), 350)
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save the campus drive.') } finally { setSaving(false) }
  }
  const changeStatus = async (jobId: string, action: 'publish' | 'unpublish' | 'close') => { try { const job = await setCampusJobStatus(jobId, action); setJobs((items) => items.map((item) => item.id === job.id ? job : item)); setNotice('Campus-drive status updated.') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update the campus drive.') } }
  const archive = async (jobId: string) => { try { const job = await archiveCampusJob(jobId); setJobs((items) => items.map((item) => item.id === job.id ? job : item)); setNotice('Campus drive archived.') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to archive the campus drive.') } }
  const visibleJobs = filter === 'ALL' ? jobs : jobs.filter((job) => job.jobStatus === filter)

  return <section className="placement-workspace tpo-workspace">
    {error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}{notice && <div className="placement-notice"><Check size={16} />{notice}</div>}
    <section className="placement-header"><div><p className="eyebrow">{isEditor ? 'MANAGE DRIVES' : 'PLACEMENT DRIVES'}</p><h2>{page === 'new' ? 'Create campus drive' : page === 'detail' ? 'Drive details' : 'Manage drives'}</h2><p className="muted">{isEditor ? 'Define official eligibility criteria for this on-campus opportunity.' : 'Create, publish, close, archive, and analyze on-campus placement drives.'}</p></div>{!isEditor && <button className="primary-button" onClick={() => onNavigate('/tpo/drives/new')}><Plus size={16} />Create drive</button>}</section>
    {isEditor ? <section className="placement-card tpo-job-form"><div className="result-header"><div><p className="eyebrow">{editingId ? 'EDIT CAMPUS DRIVE' : 'NEW CAMPUS DRIVE'}</p><h3>{editingId ? 'Update drive criteria' : 'Save a draft'}</h3></div><button className="text-button" onClick={() => onNavigate('/tpo/drives')}>Back to drives</button></div>{loading && page === 'detail' ? <div className="placement-loading"><LoaderCircle className="spin" size={22} /></div> : <><div className="profile-form-grid"><label>Company<input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label><label>Role<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label>CTC<input value={form.ctc} onChange={(event) => setForm({ ...form, ctc: event.target.value })} /></label><label>CTC in LPA<input type="number" min="0" value={form.ctcLpa ?? ''} onChange={(event) => setForm({ ...form, ctcLpa: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>Application deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label>Minimum CGPA<input type="number" min="0" max="10" step="0.01" value={form.minimumCgpa ?? ''} onChange={(event) => setForm({ ...form, minimumCgpa: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Maximum backlogs<input type="number" min="0" value={form.maximumBacklogs ?? ''} onChange={(event) => setForm({ ...form, maximumBacklogs: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Employment type<input value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} /></label><label>Eligible graduation years <small>Comma-separated</small><input value={form.graduationYears.join(', ')} onChange={(event) => setForm({ ...form, graduationYears: commaList(event.target.value).map(Number).filter(Number.isInteger) })} /></label><label className="profile-full">Eligible branches <small>Comma-separated; normalized consistently</small><input value={form.eligibleBranches.join(', ')} onChange={(event) => setForm({ ...form, eligibleBranches: commaList(event.target.value) })} /></label><label className="profile-full">Job description<textarea value={form.jobDescription} onChange={(event) => setForm({ ...form, jobDescription: event.target.value })} /></label><label className="profile-full">Additional criteria<textarea value={form.additionalCriteria} onChange={(event) => setForm({ ...form, additionalCriteria: event.target.value })} /></label></div><ProfileMultiSelect label="Required skills" hint="Centralized skill catalog" placeholder="Select required skills" groups={skills} selected={form.requiredSkills} onChange={(requiredSkills) => setForm({ ...form, requiredSkills })} /><button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{editingId ? 'Save changes' : 'Save draft'}</button></>}</section> : <section className="placement-section"><div className="drive-status-tabs">{['ALL', 'DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'].map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'ALL' ? 'All drives' : status[0] + status.slice(1).toLowerCase()}</button>)}</div>{loading ? <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Loading campus drives...</p></section> : <div className="job-grid">{visibleJobs.length ? visibleJobs.map((job) => <article className="placement-card job-card" key={job.id}><div className="job-card-top"><div><p className="eyebrow">{job.companyName || 'Company not provided'}</p><h3>{job.role || 'Role not provided'}</h3></div><span className="status-badge active">{job.jobStatus}</span></div><div className="job-facts"><span>{job.location || 'Location not provided'}</span><span>{job.ctc || 'Salary not provided'}</span><span>{job.deadline ? new Date(job.deadline).toLocaleDateString('en-IN') : 'Deadline not provided'}</span></div><div className="tpo-job-actions"><button className="secondary-button" onClick={() => onNavigate(`/tpo/drives/${job.id}`)}><Edit3 size={15} />View / edit</button><button className="secondary-button" onClick={() => onOpenAnalytics(job.id)}><BarChart3 size={15} />Analytics</button>{job.jobStatus !== 'PUBLISHED' && job.jobStatus !== 'ARCHIVED' && <button className="primary-button" onClick={() => void changeStatus(job.id, 'publish')}><Send size={15} />Publish</button>}{job.jobStatus === 'PUBLISHED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'unpublish')}>Unpublish</button>}{job.jobStatus !== 'CLOSED' && job.jobStatus !== 'ARCHIVED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'close')}>Close</button>}<button className="text-button" onClick={() => void archive(job.id)}><Trash2 size={15} />Archive</button></div></article>) : <section className="placement-card empty-placement"><Plus size={26} /><h3>No drives in this view.</h3><p>Create a campus drive when the TPO receives an opportunity.</p></section>}</div>}</section>}
  </section>
}
