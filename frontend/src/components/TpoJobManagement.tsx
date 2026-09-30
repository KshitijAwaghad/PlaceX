import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardList, Edit3, LoaderCircle, Plus, Send, Trash2, X } from 'lucide-react'
import applicationStatuses from '../../../shared/applicationStatuses.json'
import profileCatalog from '../../../shared/profileCatalog.json'
import { archiveCampusJob, createCampusJob, getCampusJobApplications, getEligibleCampusStudents, getManagedCampusJobs, setCampusJobStatus, updateCampusApplicationStatus, updateCampusJob, type CampusJobInput } from '../services/api'
import type { PlacementApplication, PlacementJob } from '../types/placement'
import ProfileMultiSelect from './ProfileMultiSelect'
import '../placement.css'

const emptyJob = (): CampusJobInput => ({ companyName: '', role: '', jobDescription: '', ctc: '', ctcLpa: null, location: '', deadline: '', requiredSkills: [], eligibleBranches: [], minimumCgpa: null, maximumBacklogs: null, graduationYears: [], employmentType: '', additionalCriteria: '' })
function commaList(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean) }

export default function TpoJobManagement() {
  const [jobs, setJobs] = useState<PlacementJob[]>([])
  const [form, setForm] = useState<CampusJobInput>(emptyJob)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [applications, setApplications] = useState<PlacementApplication[]>([])
  const [applicationsJobId, setApplicationsJobId] = useState<string | null>(null)
  const [eligibleStudents, setEligibleStudents] = useState<{ studentId: string; profile: { fullName: string; branch: string; cgpa: number | null; graduationYear: number | null } }[]>([])
  const [eligibleJobId, setEligibleJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const skills = useMemo(() => profileCatalog.skillCategories.map((category) => ({ name: category.name, options: category.skills })), [])

  const loadJobs = async () => {
    setLoading(true)
    try { setJobs(await getManagedCampusJobs()) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load campus jobs.') } finally { setLoading(false) }
  }
  useEffect(() => { void loadJobs() }, [])

  const reset = () => { setForm(emptyJob()); setEditingId(null) }
  const edit = (job: PlacementJob) => {
    setEditingId(job.id)
    setForm({
      companyName: job.companyName || '', role: job.role || '', jobDescription: job.jobDescription || '', ctc: job.ctc || '', ctcLpa: job.ctcLpa,
      location: job.location || '', deadline: job.deadline ? job.deadline.slice(0, 10) : '', requiredSkills: job.requiredSkills,
      eligibleBranches: job.eligibleBranches, minimumCgpa: job.minimumCgpa, maximumBacklogs: job.maximumBacklogs,
      graduationYears: job.graduationYears, employmentType: job.employmentType || '', additionalCriteria: job.additionalCriteria || ''
    })
    setApplications([]); setApplicationsJobId(null)
  }
  const save = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const job = editingId ? await updateCampusJob(editingId, form) : await createCampusJob(form)
      setJobs((items) => editingId ? items.map((item) => item.id === job.id ? job : item) : [job, ...items])
      setNotice(editingId ? 'Campus drive updated.' : 'Campus drive saved as a draft. Publish it when ready.')
      reset()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save the campus drive.') } finally { setSaving(false) }
  }
  const changeStatus = async (jobId: string, action: 'publish' | 'unpublish' | 'close') => {
    setError('')
    try { const job = await setCampusJobStatus(jobId, action); setJobs((items) => items.map((item) => item.id === job.id ? job : item)); setNotice('Campus-drive status updated.') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update the campus drive.') }
  }
  const archive = async (jobId: string) => {
    setError('')
    try { const job = await archiveCampusJob(jobId); setJobs((items) => items.map((item) => item.id === job.id ? job : item)); setNotice('Campus drive archived.') } catch (err) { setError(err instanceof Error ? err.message : 'Unable to archive the campus drive.') }
  }
  const viewApplications = async (jobId: string) => {
    setApplicationsJobId(jobId); setError('')
    try { setApplications(await getCampusJobApplications(jobId)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load applications.') }
  }
  const updateStatus = async (applicationId: string, status: string) => {
    try { const application = await updateCampusApplicationStatus(applicationId, status); setApplications((items) => items.map((item) => item.id === application.id ? application : item)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update application status.') }
  }
  const viewEligibleStudents = async () => {
    if (!eligibleJobId) return
    setError('')
    try { setEligibleStudents(await getEligibleCampusStudents(eligibleJobId)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load eligible students.') }
  }

  return <section className="placement-workspace tpo-workspace">
    {error && <div className="error-banner">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
    {notice && <div className="placement-notice"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss confirmation"><X size={16} /></button></div>}
    <section className="placement-header"><div><p className="eyebrow">TPO WORKSPACE</p><h2>On-Campus Hiring</h2><p className="muted">Create, publish, manage, and close campus placement drives from MongoDB.</p></div><button className="primary-button" onClick={reset}><Plus size={16} />New campus drive</button></section>
    <section className="placement-card tpo-job-form"><div className="result-header"><div><p className="eyebrow">{editingId ? 'EDIT CAMPUS DRIVE' : 'NEW CAMPUS DRIVE'}</p><h3>{editingId ? 'Update criteria' : 'Create a draft'}</h3></div>{editingId && <button className="text-button" onClick={reset}>Cancel edit</button>}</div><div className="profile-form-grid"><label>Company<input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label><label>Role<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label>CTC<input value={form.ctc} onChange={(event) => setForm({ ...form, ctc: event.target.value })} /></label><label>CTC in LPA<input type="number" min="0" value={form.ctcLpa ?? ''} onChange={(event) => setForm({ ...form, ctcLpa: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>Application deadline<input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label><label>Minimum CGPA<input type="number" min="0" max="10" step="0.01" value={form.minimumCgpa ?? ''} onChange={(event) => setForm({ ...form, minimumCgpa: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Maximum backlogs<input type="number" min="0" value={form.maximumBacklogs ?? ''} onChange={(event) => setForm({ ...form, maximumBacklogs: event.target.value === '' ? null : Number(event.target.value) })} /></label><label>Employment type<input value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} /></label><label>Eligible graduation years <small>Comma-separated</small><input value={form.graduationYears.join(', ')} onChange={(event) => setForm({ ...form, graduationYears: commaList(event.target.value).map(Number).filter(Number.isInteger) })} /></label><label className="profile-full">Eligible branches <small>Comma-separated; normalized consistently</small><input value={form.eligibleBranches.join(', ')} onChange={(event) => setForm({ ...form, eligibleBranches: commaList(event.target.value) })} /></label><label className="profile-full">Job description<textarea value={form.jobDescription} onChange={(event) => setForm({ ...form, jobDescription: event.target.value })} /></label><label className="profile-full">Additional criteria<textarea value={form.additionalCriteria} onChange={(event) => setForm({ ...form, additionalCriteria: event.target.value })} /></label></div><ProfileMultiSelect label="Required skills" hint="Centralized skill catalog" placeholder="Select required skills" groups={skills} selected={form.requiredSkills} onChange={(requiredSkills) => setForm({ ...form, requiredSkills })} /><button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{editingId ? 'Save changes' : 'Save draft'}</button></section>
    <section className="placement-section"><div className="placement-section-heading"><div><p className="eyebrow">CAMPUS DRIVE RECORDS</p><h2>Managed drives</h2></div></div>{loading ? <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Loading campus drives...</p></section> : <div className="job-grid">{jobs.length ? jobs.map((job) => <article className="placement-card job-card" key={job.id}><div className="job-card-top"><div><p className="eyebrow">{job.companyName || 'Company not provided'}</p><h3>{job.role || 'Role not provided'}</h3></div><span className="status-badge active">{job.jobStatus}</span></div><div className="job-facts"><span>{job.location || 'Location not provided'}</span><span>{job.ctc || 'Salary not provided'}</span><span>{job.deadline ? new Date(job.deadline).toLocaleDateString('en-IN') : 'Deadline not provided'}</span></div><div className="tpo-job-actions"><button className="secondary-button" onClick={() => edit(job)}><Edit3 size={15} />Edit</button>{job.jobStatus !== 'PUBLISHED' && job.jobStatus !== 'ARCHIVED' && <button className="primary-button" onClick={() => void changeStatus(job.id, 'publish')}><Send size={15} />Publish</button>}{job.jobStatus === 'PUBLISHED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'unpublish')}>Unpublish</button>}{job.jobStatus !== 'CLOSED' && job.jobStatus !== 'ARCHIVED' && <button className="secondary-button" onClick={() => void changeStatus(job.id, 'close')}>Close</button>}<button className="secondary-button" onClick={() => void viewApplications(job.id)}><ClipboardList size={15} />Applications</button><button className="text-button" onClick={() => void archive(job.id)}><Trash2 size={15} />Archive</button></div></article>) : <section className="placement-card empty-placement"><ClipboardList size={26} /><h3>No campus drives yet.</h3><p>Create a draft when the TPO receives an opportunity.</p></section>}</div>}</section>
    {applicationsJobId && <section className="placement-card manager-applications"><div className="result-header"><div><p className="eyebrow">CAMPUS APPLICATIONS</p><h3>Applicant status</h3></div><button className="text-button" onClick={() => { setApplicationsJobId(null); setApplications([]) }}>Close</button></div>{applications.length ? <div className="manager-application-list">{applications.map((application) => <article className="application-card" key={application.id}><strong>{application.job?.companyName || 'Campus drive'} · {application.job?.role || 'Role'}</strong><small>Applied {new Date(application.appliedAt).toLocaleDateString('en-IN')}</small><select value={application.status} onChange={(event) => void updateStatus(application.id, event.target.value)}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></article>)}</div> : <p className="muted">No applications have been submitted for this drive.</p>}</section>}
    <section className="placement-card manager-applications"><div className="result-header"><div><p className="eyebrow">ELIGIBLE STUDENTS</p><h3>Current campus-drive matches</h3></div></div><div className="profile-actions"><select value={eligibleJobId} onChange={(event) => setEligibleJobId(event.target.value)}><option value="">Select a campus drive</option>{jobs.filter((job) => job.jobStatus === 'PUBLISHED').map((job) => <option value={job.id} key={job.id}>{job.companyName || 'Company not provided'} · {job.role || 'Role not provided'}</option>)}</select><button className="secondary-button" disabled={!eligibleJobId} onClick={() => void viewEligibleStudents()}>View eligible students</button></div>{eligibleStudents.length > 0 && <div className="manager-application-list">{eligibleStudents.map((student) => <article className="application-card" key={student.studentId}><strong>{student.profile.fullName || student.studentId}</strong><span>{student.profile.branch || 'Branch not provided'}</span><small>CGPA {student.profile.cgpa ?? 'not provided'} · Graduation {student.profile.graduationYear ?? 'not provided'}</small></article>)}</div>}</section>
  </section>
}
