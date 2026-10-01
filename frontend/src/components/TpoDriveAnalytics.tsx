import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, LoaderCircle, SlidersHorizontal, UsersRound, XCircle } from 'lucide-react'
import { getCampusDriveAnalytics } from '../services/api'
import type { DriveAnalytics, DriveAnalyticsStudent } from '../types/placement'
import '../placement.css'

type StudentList = 'eligible' | 'training'

function displayPercent(value: number) {
  return `${Math.round(value)}%`
}

function StudentCards({ students, type }: { students: DriveAnalyticsStudent[]; type: StudentList }) {
  if (!students.length) return <p className="muted">No students match the selected filters.</p>
  return <div className="analytics-student-grid">{students.map((student) => <article className="analytics-student-card" key={student.studentId}>
    <div><strong>{student.fullName || student.studentId}</strong><span>{student.branch || 'Branch not provided'} · CGPA {student.cgpa ?? 'Not provided'}</span></div>
    <small>Application: {student.applicationStatus || 'No application recorded'}</small>
    <div className="analytics-skill-match"><span>Skill match</span><b>{student.skillMatch.matchedSkills}/{student.skillMatch.requiredSkills}</b></div>
    {type === 'eligible'
      ? <div className="analytics-skills">{student.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      : <div className="analytics-skills gaps">{student.missingSkills.map((skill) => <span key={skill}>{skill}</span>)}</div>}
  </article>)}</div>
}

export default function TpoDriveAnalytics({ driveId, onBack }: { driveId: string; onBack: () => void }) {
  const [analytics, setAnalytics] = useState<DriveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [studentList, setStudentList] = useState<StudentList>('eligible')

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setAnalytics(null); setSelectedBranch(''); setSelectedSkill(''); setStudentList('eligible')
    void getCampusDriveAnalytics(driveId)
      .then((result) => { if (current) setAnalytics(result) })
      .catch((err) => { if (current) setError(err instanceof Error ? err.message : 'Unable to load drive analytics.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [driveId])

  const branches = useMemo(() => analytics?.branchAnalysis.map((item) => item.branch) || [], [analytics])
  const visibleEligible = useMemo(() => (analytics?.eligibleStudents || []).filter((student) => (
    !selectedBranch || (student.branch || 'Not provided') === selectedBranch
  )), [analytics, selectedBranch])
  const visibleTraining = useMemo(() => (analytics?.trainingCandidates || []).filter((student) => {
    const branchMatches = !selectedBranch || (student.branch || 'Not provided') === selectedBranch
    const skillMatches = !selectedSkill || student.missingSkills.includes(selectedSkill)
    return branchMatches && skillMatches
  }), [analytics, selectedBranch, selectedSkill])
  const maxGap = Math.max(...(analytics?.skillGaps.map((gap) => gap.studentsMissing) || [0]), 1)
  const visibleStudents = studentList === 'eligible' ? visibleEligible : visibleTraining
  const topSkills = analytics?.skillGaps.slice(0, 4) || []

  if (loading) return <section className="placement-card placement-loading"><LoaderCircle className="spin" size={24} /><p>Calculating live drive analytics...</p></section>
  if (error || !analytics) return <section className="placement-card analytics-error"><button className="text-button" onClick={onBack}><ArrowLeft size={15} />Back to drives</button><p>{error || 'Drive analytics are unavailable.'}</p></section>

  const { summary } = analytics
  return <section className="placement-workspace analytics-workspace">
    <section className="placement-header analytics-header"><div><button className="text-button analytics-back" onClick={onBack}><ArrowLeft size={15} />Placement drives</button><p className="eyebrow">DRIVE ANALYTICS</p><h2>{analytics.drive.companyName || 'Campus drive'} · {analytics.drive.role || 'Role not provided'}</h2><p className="muted">Live analysis of active student profiles against this drive’s official eligibility criteria.</p></div><div className="readiness-chip"><span>Drive eligibility readiness</span><strong>{displayPercent(summary.driveEligibilityReadiness)}</strong></div></section>

    <section className="analytics-summary-grid">
      <article className="analytics-summary-card"><UsersRound size={18} /><span>Students analyzed</span><strong>{summary.totalStudents}</strong></article>
      <article className="analytics-summary-card eligible"><CheckCircle2 size={18} /><span>Eligible</span><strong>{summary.eligible}</strong></article>
      <article className="analytics-summary-card partial"><SlidersHorizontal size={18} /><span>Partial match</span><strong>{summary.partialMatch}</strong></article>
      <article className="analytics-summary-card ineligible"><XCircle size={18} /><span>Not eligible</span><strong>{summary.notEligible}</strong></article>
    </section>

    <section className="placement-card analytics-explanation"><p><b>{summary.eligible}</b> students currently meet all mandatory criteria.</p><p><b>{summary.partialMatch}</b> students meet fixed criteria and could benefit from targeted skill training.</p><p><b>{summary.notEligible}</b> students fail one or more fixed eligibility conditions; training alone will not make them eligible.</p></section>

    <section className="analytics-two-column">
      <section className="placement-card analytics-chart"><div className="result-header"><div><p className="eyebrow">STUDENT FIT</p><h3>Fit distribution</h3></div></div><div className="fit-bars">{[
        { label: 'Eligible', value: summary.eligible, tone: 'eligible' },
        { label: 'Partial match', value: summary.partialMatch, tone: 'partial' },
        { label: 'Not eligible', value: summary.notEligible, tone: 'ineligible' }
      ].map((item) => <div className="fit-bar-row" key={item.label}><span>{item.label}</span><div><i className={item.tone} style={{ width: `${summary.totalStudents ? (item.value / summary.totalStudents) * 100 : 0}%` }} /></div><b>{item.value}</b></div>)}</div></section>
      <section className="placement-card analytics-chart"><div className="result-header"><div><p className="eyebrow">TRAINING PRIORITIES</p><h3>Students needing each skill</h3></div></div>{analytics.trainingPriorities.length ? <ol className="training-priority-list">{analytics.trainingPriorities.slice(0, 5).map((priority) => <li key={priority.skill}><b>{priority.skill}</b><span>{priority.studentsMissing} students · {displayPercent(priority.percentage)} of analyzed students</span></li>)}</ol> : <p className="muted">This drive has no required skills, so there are no skill gaps to prioritize.</p>}</section>
    </section>

    <section className="placement-card analytics-chart"><div className="result-header"><div><p className="eyebrow">SKILL GAP ANALYSIS</p><h3>Top missing skills</h3></div></div>{analytics.skillGaps.length ? <div className="skill-gap-bars">{analytics.skillGaps.map((gap) => <div className="skill-gap-row" key={gap.skill}><span>{gap.skill}</span><div><i style={{ width: `${(gap.studentsMissing / maxGap) * 100}%` }} /></div><b>{gap.studentsMissing}</b><small>{displayPercent(gap.percentage)}</small></div>)}</div> : <p className="muted">No skill gaps were found for the analyzed student population.</p>}</section>

    <section className="analytics-two-column">
      <section className="placement-card analytics-chart"><div className="result-header"><div><p className="eyebrow">BRANCH ANALYSIS</p><h3>Drive readiness by branch</h3></div></div>{analytics.branchAnalysis.length ? <div className="branch-readiness-list">{analytics.branchAnalysis.map((branch) => <div key={branch.branch}><div><strong>{branch.branch}</strong><span>{branch.eligibleStudents}/{branch.totalStudents} fully eligible</span></div><div className="branch-readiness-track"><i style={{ width: `${branch.readinessPercentage}%` }} /></div><b>{displayPercent(branch.readinessPercentage)}</b></div>)}</div> : <p className="muted">No active student profiles are available for branch analysis.</p>}</section>
      <section className="placement-card analytics-chart"><div className="result-header"><div><p className="eyebrow">SKILL GAPS BY BRANCH</p><h3>Where demand is concentrated</h3></div></div>{topSkills.length && analytics.branchSkillGaps.length ? <div className="branch-gap-table-wrap"><table className="branch-gap-table"><thead><tr><th>Branch</th>{topSkills.map((skill) => <th key={skill.skill}>{skill.skill}</th>)}</tr></thead><tbody>{analytics.branchSkillGaps.map((branch) => <tr key={branch.branch}><td>{branch.branch}</td>{topSkills.map((skill) => <td key={skill.skill}>{branch.skillGaps.find((gap) => gap.skill === skill.skill)?.studentsMissing || 0}</td>)}</tr>)}</tbody></table></div> : <p className="muted">There are no branch-level skill gaps for this drive.</p>}</section>
    </section>

    <section className="placement-card analytics-students"><div className="result-header"><div><p className="eyebrow">STUDENT LISTS</p><h3>{studentList === 'eligible' ? 'Eligible students' : 'Students needing training'}</h3></div><div className="analytics-list-tabs"><button className={studentList === 'eligible' ? 'active' : ''} onClick={() => setStudentList('eligible')}>View eligible students ({summary.eligible})</button><button className={studentList === 'training' ? 'active' : ''} onClick={() => setStudentList('training')}>Students needing training ({summary.partialMatch})</button></div></div>
      <div className="analytics-filters"><label>Branch<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label>{studentList === 'training' && <label>Training gap<select value={selectedSkill} onChange={(event) => setSelectedSkill(event.target.value)}><option value="">All skills</option>{analytics.skillGaps.map((gap) => <option key={gap.skill} value={gap.skill}>{gap.skill}</option>)}</select></label>}</div>
      <StudentCards students={visibleStudents} type={studentList} />
    </section>
  </section>
}
