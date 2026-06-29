import { motion } from 'framer-motion'
import { User, HeartHandshake, Target } from 'lucide-react'

/**
 * The Inclusivity Section.
 *
 * Designed to introduce LEVEL's inclusive matching system in a way that feels
 * sophisticated and naturally integrated — never corporate, never performative.
 *
 * Three pillars:
 *   1. Identity — gender identity & pronouns
 *   2. Orientation — sexual orientation & preferred genders
 *   3. Intention — relationship structure & lifestyle compatibility
 */

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Transgender',
  'Prefer not to say',
  '+ Add your own',
]

const ORIENTATION_OPTIONS = [
  'Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Pansexual',
  'Asexual',
  'Queer',
  '+ Add your own',
]

const PRONOUN_OPTIONS = [
  'she / her',
  'he / him',
  'they / them',
  'she / they',
  'he / they',
  '+ Add your own',
]

function Pillar({ index, title, body, accent, Icon }) {
  return (
    <motion.div
      className="flex gap-4"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 44, height: 44, borderRadius: 13, color: accent, background: `${accent}1A`, border: `1px solid ${accent}40`, boxShadow: `0 0 18px ${accent}22` }}
      >
        <Icon size={20} strokeWidth={1.6} />
      </span>
      <div>
        <p className="eyebrow mb-1.5" style={{ color: accent }}>0{index + 1} · {title}</p>
        <p className="font-sans text-cream-100/70" style={{ fontSize: '0.92rem', lineHeight: 1.6, fontWeight: 300 }}>
          {body}
        </p>
      </div>
    </motion.div>
  )
}

function OptionStack({ title, options, accent, side, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className="surface surface-hover rounded-3xl p-8 relative overflow-hidden"
    >
      {/* Top accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}cc, transparent)`,
        }}
      />

      <div className="flex items-center justify-between mb-5">
        <p className="eyebrow" style={{ color: accent }}>{title}</p>
        <span
          className="font-display text-cream-100/30"
          style={{ fontSize: '0.85rem' }}
        >
          {side}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => {
          const isCustom = opt.startsWith('+')
          return (
            <span
              key={opt}
              className="inline-flex items-center px-3.5 py-2 rounded-full font-sans transition-colors duration-300 cursor-default"
              style={{
                fontSize: '0.78rem',
                fontWeight: 400,
                letterSpacing: '0.02em',
                background: isCustom
                  ? 'transparent'
                  : i === 0
                    ? `${accent}1A`
                    : 'rgba(245,237,224,0.04)',
                border: isCustom
                  ? `1px dashed ${accent}66`
                  : `1px solid ${i === 0 ? `${accent}55` : 'rgba(245,237,224,0.10)'}`,
                color: isCustom
                  ? accent
                  : i === 0
                    ? accent
                    : 'rgba(245,237,224,0.78)',
              }}
            >
              {opt}
            </span>
          )
        })}
      </div>
    </motion.div>
  )
}

export default function InclusivitySection() {
  return (
    <section id="inclusivity" className="relative py-32 px-6 lg:px-10 overflow-hidden">
      {/* Prism ribbon — running edge to edge */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 10%, rgba(232,199,160,0.4) 30%, rgba(229,181,181,0.4) 45%, rgba(184,168,212,0.4) 60%, rgba(155,203,180,0.4) 75%, transparent 90%)',
        }}
      />

      {/* Aurora glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(184,168,212,0.10) 0%, rgba(229,181,181,0.06) 40%, transparent 75%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* Header column */}
          <motion.div
            className="lg:col-span-5 lg:sticky lg:top-32"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="hairline-prism" />
              <span className="eyebrow">Inclusivity</span>
            </div>
            <h2
              className="font-display text-cream-50 leading-[1.04] mb-7 text-balance"
              style={{ fontSize: 'clamp(2.2rem, 4.4vw, 3.6rem)', fontWeight: 300, letterSpacing: '-0.025em' }}
            >
              Built for the
              <br />
              <span className="accent-italic text-prism">full spectrum</span>
              <br />
              of ambition.
            </h2>
            <p
              className="font-sans text-cream-100/65 mb-11"
              style={{ fontSize: '1rem', lineHeight: 1.75, fontWeight: 300 }}
            >
              Across every identity, orientation and relationship model — partners
              who match your depth. Inclusivity isn&apos;t a feature here; it&apos;s the architecture.
            </p>

            <div className="space-y-7">
              <Pillar
                index={0}
                title="Identity"
                accent="#E5B5B5"
                Icon={User}
                body="Gender identity and pronouns lead every introduction — connection begins with respect."
              />
              <Pillar
                index={1}
                title="Orientation"
                accent="#E8C7A0"
                Icon={HeartHandshake}
                body="Define orientation in your own words. Matching is mutual — you choose who you're open to."
              />
              <Pillar
                index={2}
                title="Intention"
                accent="#B8A8D4"
                Icon={Target}
                body="Long-term, marriage, slow-burn, or ethical non-monogamy — your model, honoured."
              />
            </div>
          </motion.div>

          {/* Option preview column */}
          <div className="lg:col-span-7 space-y-5">
            <OptionStack
              title="Gender identity"
              side="Step 02 · Onboarding"
              accent="#E5B5B5"
              delay={0.1}
              options={GENDER_OPTIONS}
            />
            <OptionStack
              title="Sexual orientation"
              side="Step 03 · Onboarding"
              accent="#E8C7A0"
              delay={0.2}
              options={ORIENTATION_OPTIONS}
            />
            <OptionStack
              title="Pronouns"
              side="Step 04 · Onboarding"
              accent="#B8A8D4"
              delay={0.3}
              options={PRONOUN_OPTIONS}
            />

            {/* Closing thought */}
            <motion.div
              className="mt-6 px-7 py-6 rounded-2xl flex items-start gap-5"
              style={{
                background:
                  'linear-gradient(120deg, rgba(232,199,160,0.06), rgba(184,168,212,0.06), rgba(155,203,180,0.06))',
                border: '1px solid rgba(245,237,224,0.10)',
              }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                style={{
                  background:
                    'conic-gradient(from 220deg, #E8C7A0, #E5B5B5, #B8A8D4, #9BCBB4, #E8C7A0)',
                  boxShadow: '0 0 14px rgba(212,165,116,0.4)',
                }}
              />
              <p
                className="font-sans text-cream-100/75 italic"
                style={{ fontSize: '0.92rem', lineHeight: 1.7, fontWeight: 300 }}
              >
                Whatever you share stays yours — you choose what&apos;s shown, to whom, and when.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
