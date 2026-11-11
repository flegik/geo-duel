import {useState} from 'react';
import {Check, ChevronDown, Minus, X} from 'lucide-react';
import {AnswerOption,hasFlagOptions} from './AnswerOption';
import {AnswerDiscovery} from './AnswerDiscovery';
import {QuestionMedia,QuestionImageCredit} from './QuestionMedia';
import {categories} from './engine';
import type {DuelReviewAnswer, DuelReviewQuestion, MatchResult} from './api';
import './duelReview.css';

type ReviewPlayer = Pick<MatchResult['players'][number], 'id' | 'nickname'>;

function PlayerStatus({name, answer, correct}:{
  name:string; answer:DuelReviewAnswer|undefined; correct:number;
}) {
  const status = !answer ? 'missing' : answer.selected === correct ? 'right' : 'wrong';
  const Icon = status === 'right' ? Check : status === 'wrong' ? X : Minus;
  const label = status === 'right' ? 'Richtig' : status === 'wrong' ? 'Falsch' : 'Keine Antwort';

  return (
    <span className="duel-review-player">
      <strong>{name}</strong>
      <span className={`duel-review-status ${status}`}>
        <Icon size={16} aria-hidden="true"/>
        {label}
        {answer && <span className="duel-review-points">· {answer.points} Pkt.</span>}
      </span>
    </span>
  );
}

function ReviewCard({question, players, ownId}:{
  question:DuelReviewQuestion; players:ReviewPlayer[]; ownId:string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<number|null>(null);
  const choices = players.map(player => ({
    id:player.id,
    name:player.id === ownId ? 'Du' : player.nickname,
    answer:question.answers.find(answer => answer.profileId === player.id),
  }));

  return (
    <details className="duel-review-card" onToggle={event => {
      if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
    }}>
      <summary>
        <span className="duel-review-meta">Frage {question.position + 1} · {categories[question.category].name}</span>
        <ChevronDown className="duel-review-chevron" size={19} aria-hidden="true"/>
        <span className="duel-review-prompt">{question.prompt}</span>
        <span className="duel-review-players">
          {choices.map(choice => <PlayerStatus key={choice.id} {...choice} correct={question.correct}/>)}
        </span>
      </summary>
      {open && <div className="duel-review-detail">
         {question.media?.type==='city-map' && <QuestionMedia media={question.media} options={question.options}
          location={question.provenance?.cityLocation} correct={question.correct} onSelect={setPreview}/>}
        {question.media && question.media.type!=='city-map' && !hasFlagOptions(question.media) && <div className={`question-image ${question.category}`}><QuestionMedia media={question.media}/></div>}
        <div className={hasFlagOptions(question.media)?'answers flag-options':'answers'}>
          {question.options.map((option, index) => {
            const correct = index === question.correct;
            const selectedBy = choices.filter(choice => choice.answer?.selected === index);
            return (
              <button key={index} type="button" className={`answer duel-review-option ${correct ? 'correct' : ''}`}
                aria-pressed={preview === index} onClick={() => setPreview(preview === index ? null : index)}>
                <span className="letter" aria-hidden="true">{'ABCD'[index]}</span>
                <span className="duel-review-option-text">
                  <AnswerOption option={option} media={question.media} revealed/>
                  {(correct || selectedBy.length > 0) && <span className="duel-review-tags">
                    {correct && <span className="solution"><Check size={14} aria-hidden="true"/> Richtige Lösung</span>}
                    {selectedBy.map(choice => <span key={choice.id} className={correct ? 'right' : 'wrong'}>
                      {correct ? <Check size={14} aria-hidden="true"/> : <X size={14} aria-hidden="true"/>}
                      {choice.name} {choice.id === ownId ? 'hast' : 'hat'} gewählt
                    </span>)}
                  </span>}
                </span>
              </button>
            );
          })}
        </div>
        <AnswerDiscovery category={question.category} options={question.options} selected={preview} onSelect={setPreview} resolution={question.provenance}/>
        <div className="duel-review-explanation">
          <strong>Erklärung</strong>
          <p>{question.explanation}</p>
          <QuestionImageCredit credit={question.provenance?.imageCredit}/>
          {question.provenance?.sources[0] && <a href={question.provenance.sources[0]} target="_blank" rel="noreferrer">Quelle ansehen ↗</a>}
        </div>
      </div>}
    </details>
  );
}

export function DuelReview({questions, players, ownId}:{
  questions:DuelReviewQuestion[]; players:ReviewPlayer[]; ownId:string;
}) {
  return (
    <section id="duel-review" className="duel-review" aria-labelledby="duel-review-title">
      <div className="section-heading">
        <h2 id="duel-review-title">Eure Antworten</h2>
        <span>{questions.length} Fragen</span>
      </div>
      {questions.map(question => <ReviewCard key={question.position} question={question} players={players} ownId={ownId}/>)}
    </section>
  );
}
