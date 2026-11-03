import { useMemo, useState } from "react";
import { DISPLAY_STATES, type ActionCategory, type DisplayState } from "@agent-workshop/shared";
import { RiggedCharacter } from "./RiggedCharacter.js";
import { behaviourFor } from "./behaviourFor.js";
import { POSES } from "./poses.js";
import { ACTIVITY_LOOPS, ACTIVITY_LOOP_LABELS } from "./loops.js";
import { EXPRESSIONS } from "./expressions.js";
import { GESTURES, GESTURE_PRESETS } from "./gestures.js";
import { CHARACTER_PALETTE } from "../characters/palette.js";
import { contrastCapColor } from "../characters/colorUtils.js";
import type { Behaviour, BehaviourContext, EffectName, Pose, ActivityLoop, Expression, GestureName, PropsConfig } from "./types.js";

const ALL_EFFECTS: EffectName[] = ["zzz", "sweat", "thought-bubble", "speech-bubble", "steam", "dizzy-stars", "sparkles", "lightbulb"];

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lab-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lab-cell">
      <div className="lab-cell-preview">{children}</div>
      <div className="lab-cell-label">{label}</div>
    </div>
  );
}

export function CharacterLab() {
  const [pose, setPose] = useState<Pose>("sitting");
  const [activityLoop, setActivityLoop] = useState<ActivityLoop>(null);
  const [expression, setExpression] = useState<Expression>("focused");
  const [eyesClosed, setEyesClosed] = useState(false);
  const [gestureName, setGestureName] = useState<GestureName>("wave");
  const [gesturePlaying, setGesturePlaying] = useState(false);
  const [effects, setEffects] = useState<Set<EffectName>>(new Set());
  const [contextState, setContextState] = useState<DisplayState>("thinking");
  const [consecutiveErrors, setConsecutiveErrors] = useState(1);
  const [donePhase, setDonePhase] = useState<1 | 2>(1);
  const [needsInputOptionCount, setNeedsInputOptionCount] = useState(2);
  const [colorIndex, setColorIndex] = useState(0);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showMonitor, setShowMonitor] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showMug, setShowMug] = useState(false);
  const [showBook, setShowBook] = useState(false);
  const [showRadio, setShowRadio] = useState(false);
  const [showSigns, setShowSigns] = useState(false);

  const teamColor = dark ? CHARACTER_PALETTE[colorIndex].dark : CHARACTER_PALETTE[colorIndex].light;
  const capColor = contrastCapColor(teamColor);

  const behaviourContext: BehaviourContext = useMemo(
    () => ({
      state: contextState,
      category: null,
      consecutiveErrors,
      isForeman: false,
      needsInputOptionCount,
      donePhase,
      longRunning: false,
      teamColor,
      capColor
    }),
    [contextState, consecutiveErrors, needsInputOptionCount, donePhase, teamColor, capColor]
  );

  const props: PropsConfig = {
    showMonitor,
    monitorContent: "code",
    showKeyboard,
    keyboardActive: showKeyboard,
    showMug,
    showBook,
    showRadio,
    signs: showSigns ? { yes: true, no: true } : null
  };

  const manualBehaviour: Behaviour = {
    pose,
    activityLoop,
    expression,
    eyesClosed,
    gesture: { name: gestureName, playing: gesturePlaying },
    props,
    effects: [...effects],
    speechBubble: effects.has("speech-bubble") ? { text: "?", optionCount: needsInputOptionCount } : null,
    teamColor,
    capColor,
    isForeman: false
  };

  const toggleEffect = (e: EffectName) =>
    setEffects((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });

  return (
    <div className={`character-lab ${dark ? "theme-dark" : "theme-light"}`}>
      <h1>Character Lab</h1>

      <div className="lab-layout">
        <div className="lab-controls">
          <Labeled label="Pose">
            <select value={pose} onChange={(e) => setPose(e.target.value as Pose)}>
              {POSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Activity loop">
            <select value={activityLoop ?? "none"} onChange={(e) => setActivityLoop(e.target.value === "none" ? null : (e.target.value as ActivityLoop))}>
              {ACTIVITY_LOOPS.map((l) => (
                <option key={l ?? "none"} value={l ?? "none"}>{ACTIVITY_LOOP_LABELS[l ?? "none"]}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Expression">
            <select value={expression} onChange={(e) => setExpression(e.target.value as Expression)}>
              {EXPRESSIONS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Eyes closed">
            <input type="checkbox" checked={eyesClosed} onChange={(e) => setEyesClosed(e.target.checked)} />
          </Labeled>
          <Labeled label="Gesture">
            <div className="lab-inline">
              <select value={gestureName} onChange={(e) => setGestureName(e.target.value as GestureName)}>
                {GESTURES.map((g) => (
                  <option key={g} value={g}>{GESTURE_PRESETS[g].label}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setGesturePlaying(true);
                  setTimeout(() => setGesturePlaying(false), GESTURE_PRESETS[gestureName].durationMs);
                }}
              >
                ▶ Play
              </button>
            </div>
          </Labeled>
          <Labeled label="Props">
            <div className="lab-checkboxes">
              <label><input type="checkbox" checked={showMonitor} onChange={(e) => setShowMonitor(e.target.checked)} /> monitor</label>
              <label><input type="checkbox" checked={showKeyboard} onChange={(e) => setShowKeyboard(e.target.checked)} /> keyboard</label>
              <label><input type="checkbox" checked={showMug} onChange={(e) => setShowMug(e.target.checked)} /> mug</label>
              <label><input type="checkbox" checked={showBook} onChange={(e) => setShowBook(e.target.checked)} /> book</label>
              <label><input type="checkbox" checked={showRadio} onChange={(e) => setShowRadio(e.target.checked)} /> radio</label>
              <label><input type="checkbox" checked={showSigns} onChange={(e) => setShowSigns(e.target.checked)} /> YES/NO signs</label>
            </div>
          </Labeled>
          <Labeled label="Effects (gated by context state below)">
            <div className="lab-checkboxes">
              {ALL_EFFECTS.map((e) => (
                <label key={e}>
                  <input type="checkbox" checked={effects.has(e)} onChange={() => toggleEffect(e)} /> {e}
                </label>
              ))}
            </div>
          </Labeled>
          <Labeled label="Context state (for effects gating + states row)">
            <select value={contextState} onChange={(e) => setContextState(e.target.value as DisplayState)}>
              {DISPLAY_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Consecutive errors">
            <input type="number" min={0} max={6} value={consecutiveErrors} onChange={(e) => setConsecutiveErrors(Number(e.target.value))} />
          </Labeled>
          <Labeled label="Done phase">
            <select value={donePhase} onChange={(e) => setDonePhase(Number(e.target.value) as 1 | 2)}>
              <option value={1}>1 (thumbs up)</option>
              <option value={2}>2 (resting)</option>
            </select>
          </Labeled>
          <Labeled label="Needs-input option count">
            <input type="number" min={0} max={6} value={needsInputOptionCount} onChange={(e) => setNeedsInputOptionCount(Number(e.target.value))} />
          </Labeled>
          <Labeled label="Team color">
            <select value={colorIndex} onChange={(e) => setColorIndex(Number(e.target.value))}>
              {CHARACTER_PALETTE.map((_, i) => (
                <option key={i} value={i}>color {i + 1}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Theme">
            <button onClick={() => setDark((d) => !d)}>{dark ? "Dark" : "Light"} (toggle)</button>
          </Labeled>
          <Labeled label="Reduced motion">
            <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
          </Labeled>
        </div>

        <div className="lab-preview">
          <RiggedCharacter behaviour={manualBehaviour} behaviourContext={behaviourContext} agentId="lab-preview" scale={1.6} reducedMotion={reducedMotion} />
        </div>
      </div>

      <h2>All states (via behaviourFor)</h2>
      <div className="lab-row">
        {DISPLAY_STATES.map((state) => {
          const ctx: BehaviourContext = {
            state,
            category: "shell" as ActionCategory,
            consecutiveErrors: state === "error" ? 1 : 0,
            isForeman: state === "supervising",
            needsInputOptionCount: 3,
            donePhase: 1,
            longRunning: false,
            teamColor,
            capColor
          };
          return (
            <Cell key={state} label={state}>
              <RiggedCharacter behaviour={behaviourFor(ctx)} behaviourContext={ctx} agentId={`lab-${state}`} scale={0.8} reducedMotion={reducedMotion} />
            </Cell>
          );
        })}
      </div>

      <h2>Done phase 1 vs phase 2 vs sleeping</h2>
      <div className="lab-row">
        {([
          ["done phase 1", { state: "done" as DisplayState, donePhase: 1 as const }],
          ["done phase 2", { state: "done" as DisplayState, donePhase: 2 as const }],
          ["sleeping", { state: "sleeping" as DisplayState, donePhase: 1 as const }]
        ] as const).map(([label, extra]) => {
          const ctx: BehaviourContext = {
            state: extra.state,
            category: null,
            consecutiveErrors: 0,
            isForeman: false,
            needsInputOptionCount: 0,
            donePhase: extra.donePhase,
            longRunning: false,
            teamColor,
            capColor
          };
          return (
            <Cell key={label} label={label}>
              <RiggedCharacter behaviour={behaviourFor(ctx)} behaviourContext={ctx} agentId={`lab-${label}`} scale={0.8} reducedMotion={reducedMotion} />
            </Cell>
          );
        })}
      </div>

      <h2>All expressions</h2>
      <div className="lab-row">
        {EXPRESSIONS.map((x) => {
          const b: Behaviour = {
            pose: "sitting",
            activityLoop: null,
            expression: x,
            eyesClosed: x === "sleepy" && false, // sleepy expression alone never closes eyes — only sleeping state does
            gesture: null,
            props: { ...props, signs: null },
            effects: [],
            speechBubble: null,
            teamColor,
            capColor,
            isForeman: false
          };
          return (
            <Cell key={x} label={x}>
              <RiggedCharacter behaviour={b} behaviourContext={{ ...behaviourContext, state: "thinking" }} agentId={`lab-expr-${x}`} scale={0.7} reducedMotion={reducedMotion} />
            </Cell>
          );
        })}
      </div>

      <h2>All gestures</h2>
      <div className="lab-row">
        {GESTURES.map((g) => (
          <Cell key={g} label={GESTURE_PRESETS[g].label}>
            <RiggedCharacter
              behaviour={{
                pose: "sitting",
                activityLoop: null,
                expression: "focused",
                eyesClosed: false,
                gesture: { name: g, playing: true },
                props: { ...props, signs: null },
                effects: [],
                speechBubble: null,
                teamColor,
                capColor,
                isForeman: false
              }}
              behaviourContext={{ ...behaviourContext, state: "thinking" }}
              agentId={`lab-gesture-${g}`}
              scale={0.7}
              reducedMotion={reducedMotion}
            />
          </Cell>
        ))}
      </div>

      <h2>needs_permission — YES/NO signs, escalated to jumping</h2>
      <div className="lab-row">
        <Cell label="needs_permission (standing)">
          <RiggedCharacter
            behaviour={behaviourFor({ ...behaviourContext, state: "needs_permission" })}
            behaviourContext={{ ...behaviourContext, state: "needs_permission" }}
            agentId="lab-permission"
            scale={0.9}
            reducedMotion={reducedMotion}
          />
        </Cell>
        <Cell label="needs_permission (escalated — jumping)">
          <RiggedCharacter
            behaviour={{ ...behaviourFor({ ...behaviourContext, state: "needs_permission" }), pose: "jumping" }}
            behaviourContext={{ ...behaviourContext, state: "needs_permission" }}
            agentId="lab-permission-jump"
            scale={0.9}
            reducedMotion={reducedMotion}
          />
        </Cell>
      </div>

      <h2>Team colors</h2>
      <div className="lab-row">
        {CHARACTER_PALETTE.map((palette, i) => {
          const c = dark ? palette.dark : palette.light;
          const ctx: BehaviourContext = { ...behaviourContext, teamColor: c, capColor: contrastCapColor(c), state: "thinking" };
          return (
            <Cell key={i} label={`color ${i + 1}`}>
              <RiggedCharacter behaviour={behaviourFor(ctx)} behaviourContext={ctx} agentId={`lab-color-${i}`} scale={0.7} reducedMotion={reducedMotion} />
            </Cell>
          );
        })}
      </div>
    </div>
  );
}
