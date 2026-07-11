import { motion } from 'framer-motion'
import { maintenanceUrl } from '../../js/maintenance.js'

export default function CTASection() {
  return (
    <section className="relative py-40 px-6 lg:px-10 overflow-hidden">
      {/* Soft prism glow backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(232,199,160,0.18) 0%, rgba(184,168,212,0.12) 35%, transparent 75%)',
        }}
      />

      <div className="max-w-4xl mx-auto relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Diamond ornament */}
          <div className="flex items-center justify-center gap-6 mb-14">
            <div
              className="h-px flex-1 max-w-24"
              style={{
                background:
                  'linear-gradient(to right, transparent, rgba(232,199,160,0.4))',
              }}
            />
            <div
              className="w-9 h-9 rotate-45 flex items-center justify-center"
              style={{
                border: '1px solid rgba(232,199,160,0.4)',
                background:
                  'linear-gradient(135deg, rgba(232,199,160,0.10), rgba(184,168,212,0.10))',
              }}
            >
              <div
                className="w-2 h-2"
                style={{
                  background:
                    'conic-gradient(from 200deg, #E8C7A0, #E5B5B5, #B8A8D4, #9BCBB4, #E8C7A0)',
                  boxShadow: '0 0 10px rgba(232,199,160,0.5)',
                }}
              />
            </div>
            <div
              className="h-px flex-1 max-w-24"
              style={{
                background:
                  'linear-gradient(to left, transparent, rgba(232,199,160,0.4))',
              }}
            />
          </div>

          <h2
            className="font-display text-cream-50 leading-[1.05] mb-8 text-balance"
            style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.4rem)', fontWeight: 300, letterSpacing: '-0.025em' }}
          >
            The right person changes
            <br />
            <span className="accent-italic text-prism">absolutely everything.</span>
          </h2>

          <p
            className="font-sans text-cream-100/65 max-w-xl mx-auto mb-14 text-balance"
            style={{ fontSize: '1.05rem', lineHeight: 1.9, fontWeight: 300 }}
          >
            You have built a remarkable life. LEVEL exists to find someone
            equally remarkable to share it with — whatever shape that life,
            love and family takes for you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={maintenanceUrl('signup')} className="btn-primary">
              Get Early Access
            </a>
            <a href="auth.html" className="btn-ghost">
              Sign in
            </a>
          </div>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 mt-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            {[
              { value: '97%', label: 'Confidentiality' },
              { value: 'All', label: 'Identities welcomed' },
              { value: '∞',   label: 'No auto-renewals' },
              { value: '24h', label: 'Cancel anytime' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-3">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: ['#E8C7A0','#E5B5B5','#B8A8D4','#9BCBB4'][i],
                    boxShadow: '0 0 10px currentColor',
                    opacity: 0.6,
                  }}
                />
                <div className="text-left">
                  <div
                    className="font-display text-cream-100/85"
                    style={{ fontSize: '1.1rem', fontWeight: 400 }}
                  >
                    {item.value}
                  </div>
                  <div
                    className="font-sans text-cream-100/40"
                    style={{ fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}
                  >
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
