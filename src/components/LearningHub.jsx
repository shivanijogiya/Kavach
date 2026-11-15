import { useState } from 'react';
import { ExternalLink, PlayCircle, Award, Clock, BookOpen } from 'lucide-react';
import { COURSES, courseById, recommendCourses, CAT_CHANNEL } from '../lib/courses';
import { actions } from '../lib/store';
import { Panel, Modal, Badge } from './ui';
import AnimatedLesson from './Animations';

const thumb = (c) => (c.video.kind === 'video' ? `https://img.youtube.com/vi/${c.video.id}/hqdefault.jpg` : null);
const embed = (c) => (c.video.kind === 'video'
  ? `https://www.youtube-nocookie.com/embed/${c.video.id}?rel=0`
  : `https://www.youtube-nocookie.com/embed/videoseries?list=${c.video.id}&rel=0`);
const watch = (c) => (c.video.kind === 'video' ? `https://www.youtube.com/watch?v=${c.video.id}` : `https://www.youtube.com/playlist?list=${c.video.id}`);

function Quiz({ course, operator, best }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const q = course.quiz[i];
  if (done) {
    const pass = score / course.quiz.length >= 0.8;
    return (
      <div className="stack">
        <h3>{pass ? 'Passed' : 'Not yet'}: {score} of {course.quiz.length}</h3>
        <p className="muted">{pass ? `+${score * 20} XP added. Your supervisor can see this result.` : 'Review the key points and the animation, then try again. You need 4 of 5 to pass.'}</p>
        <div><button className="btn" onClick={() => { setI(0); setScore(0); setPicked(null); setDone(false); }}>Retake quiz</button></div>
      </div>
    );
  }
  const choose = (k) => {
    if (picked !== null) return;
    setPicked(k);
    const right = k === q.c;
    const s = score + (right ? 1 : 0);
    setScore(s);
    setTimeout(() => {
      if (i + 1 < course.quiz.length) { setI(i + 1); setPicked(null); }
      else { setDone(true); actions.completeQuiz(operator, course.id, s, course.quiz.length); }
    }, 900);
  };
  return (
    <div>
      <div className="row between"><h3>Quiz: question {i + 1} of {course.quiz.length}</h3>{best !== undefined && <Badge tone="info">Best {best}/{course.quiz.length}</Badge>}</div>
      <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>{q.q}</p>
      {q.a.map((a, k) => (
        <button key={a} className={`quiz-opt ${picked !== null && k === q.c ? 'right' : ''} ${picked === k && k !== q.c ? 'wrong' : ''}`} onClick={() => choose(k)}>{a}</button>
      ))}
    </div>
  );
}

export default function LearningHub({ operator, op, machine, gamification, assigned, risk }) {
  const [open, setOpen] = useState(null);
  const recs = recommendCourses(op, machine, risk);
  const g = gamification ?? { xp: 0, streak: 0, badges: [], quizzes: {} };
  const course = open ? courseById[open] : null;
  const list = [...COURSES].sort((a, b) => (b.types.includes(machine?.type) ? 1 : 0) - (a.types.includes(machine?.type) ? 1 : 0));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid g-8-4">
        <Panel title="Picked for you" sub="Based on your own safety record, today's machine and recent alerts.">
          <div className="list">
            {assigned.filter((a) => !a.done).map((a) => (
              <div className="item" key={a.id}>
                <div className="icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><BookOpen size={16} /></div>
                <div style={{ flex: 1 }}>
                  <strong>{courseById[a.courseId]?.title}</strong> <Badge tone="danger">Assigned by supervisor</Badge>
                  <p className="small muted">{a.reason}</p>
                </div>
                <button className="btn sm primary" onClick={() => setOpen(a.courseId)}>Start</button>
              </div>
            ))}
            {recs.map((r) => (
              <div className="item" key={r.id}>
                <div className="icon" style={{ background: 'var(--paint-soft)', color: '#8a6d00' }}><PlayCircle size={16} /></div>
                <div style={{ flex: 1 }}>
                  <strong>{courseById[r.id].title}</strong>
                  <p className="small muted">{r.reason}</p>
                </div>
                <button className="btn sm" onClick={() => setOpen(r.id)}>Open</button>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Your progress">
          <div className="grid g2" style={{ gap: 10 }}>
            <div><div className="kpi" style={{ border: 0, padding: 0 }}><div className="v">{g.xp}<small>XP</small></div><div className="l">Level {Math.floor(g.xp / 250) + 1}</div></div></div>
            <div><div className="kpi" style={{ border: 0, padding: 0 }}><div className="v">{g.streak}<small>days</small></div><div className="l">Safety streak</div></div></div>
          </div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="small muted" style={{ marginBottom: 6 }}>Badges</div>
          <div className="row">
            {g.badges.length ? g.badges.map((b) => <Badge key={b} tone="paint"><Award size={12} />{b}</Badge>) : <span className="small muted">Pass a quiz with 4 of 5 to earn your first badge.</span>}
          </div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <a href={CAT_CHANNEL} target="_blank" rel="noreferrer" className="btn sm" style={{ textDecoration: 'none' }}><ExternalLink size={14} /> Cat Products on YouTube</a>
        </Panel>
      </div>

      <Panel title="Course library" sub="Each course: an official Cat video, an animated lesson, key points and a 5-question quiz. Courses for your machine come first.">
        <div className="course-grid">
          {list.map((c) => (
            <button key={c.id} className="course" onClick={() => setOpen(c.id)}>
              <div className="thumb" style={thumb(c) ? { backgroundImage: `url(${thumb(c)})` } : { background: 'repeating-linear-gradient(-45deg,#262822 0 14px,#33362E 14px 28px)' }}>
                {!thumb(c) && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#FFCD11', font: '600 20px var(--display)' }}>Video playlist</div>}
                <span className="play"><PlayCircle size={12} style={{ verticalAlign: -2 }} /> {c.video.kind === 'playlist' ? 'Playlist' : 'Video'} + animation</span>
              </div>
              <div className="body">
                <div className="row between"><strong style={{ fontSize: 15 }}>{c.title}</strong>{g.quizzes[c.id] !== undefined && <Badge tone={g.quizzes[c.id] >= 4 ? 'ok' : 'warn'}>{g.quizzes[c.id]}/5</Badge>}</div>
                <div className="row small muted"><Clock size={13} /> {c.minutes} min <Badge tone={c.level === 'Core' ? 'info' : 'neutral'}>{c.level}</Badge>{c.types.includes(machine?.type) && <Badge tone="paint">Your machine</Badge>}</div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      {course && (
        <Modal title={course.title} onClose={() => setOpen(null)}>
          <div className="grid g2">
            <div className="stack">
              <iframe className="video-frame" src={embed(course)} title={course.video.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              <div className="row between small">
                <span className="muted">{course.video.title}</span>
                <a href={watch(course)} target="_blank" rel="noreferrer">Watch on YouTube <ExternalLink size={12} /></a>
              </div>
              <a className="small" href={course.more} target="_blank" rel="noreferrer">More Cat videos on this topic <ExternalLink size={12} /></a>
            </div>
            <div><AnimatedLesson kind={course.animation} /></div>
          </div>
          <div className="grid g2" style={{ marginTop: 18 }}>
            <div>
              <h3 style={{ marginBottom: 8 }}>Key points</h3>
              <ol className="briefing">{course.reading.map((r) => <li key={r}>{r}</li>)}</ol>
            </div>
            <div className="panel" style={{ background: '#FBFBF9' }}>
              <Quiz key={course.id} course={course} operator={operator} best={g.quizzes[course.id]} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
