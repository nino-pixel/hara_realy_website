import React from 'react'
import { motion } from 'framer-motion'

export interface Testimonial {
  text: string
  name: string
  availedHome: string
}

const testimonials: Testimonial[] = [
  {
    text: "Clear numbers from day one. We never felt rushed, and they helped us compare two developments side by side.",
    name: "Maria Reyes",
    availedHome: "Solana Heights — Unit 4A",
  },
  {
    text: "I was skeptical about pre-selling, but the site visits and paperwork were explained in plain language.",
    name: "Jonathan Dela Cruz",
    availedHome: "The Arcadia — Aberdeen",
  },
  {
    text: "They matched us with a unit that fit our monthly budget, not just the list price. Huge relief.",
    name: "Angela Torres",
    availedHome: "Greenfield Residence",
  },
  {
    text: "Responsive on chat and email. We had a lot of questions as first-time buyers and they stuck with us.",
    name: "Ricardo Mendoza",
    availedHome: "Talanai Homes — Apitong",
  },
  {
    text: "From inquiry to reservation, every step had a checklist. Made a stressful process feel manageable.",
    name: "Liza K., Baliuag",
    availedHome: "Casa Verde — Unit B",
  },
  {
    text: "Honest about what was still under construction versus ready for occupancy. No surprises at turnover.",
    name: "Paolo Santos",
    availedHome: "Pinecrest Condo — 12B",
  },
  {
    text: "They handled all the negotiations and ensured my paperwork was perfectly tracked. Very professional team.",
    name: "Farhan Siddiqui",
    availedHome: "Sunrise Village Lot",
  },
  {
    text: "They delivered a solution that exceeded expectations, understanding our needs and enhancing our search.",
    name: "Sana Sheikh",
    availedHome: "Mountain View Lot",
  },
  {
    text: "Using their platform, we quickly evaluated options online and scheduled visits matching our exact criteria.",
    name: "Hassan Ali",
    availedHome: "The Arcadia — Aberdeen",
  },
]

const firstColumn = testimonials.slice(0, 3)
const secondColumn = testimonials.slice(3, 6)
const thirdColumn = testimonials.slice(6, 9)

const TestimonialsColumn = (props: {
  className?: string
  testimonials: Testimonial[]
  duration?: number
}) => {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent transition-colors duration-300 list-none m-0 p-0"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, name, availedHome }, i) => (
                <motion.li 
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  tabIndex={index === 1 ? -1 : 0}
                  className="w-[300px] sm:w-[350px] home-testimonial-card flex flex-col justify-between"
                  style={{ listStyleType: 'none', WebkitFontSmoothing: 'antialiased', padding: '2rem', height: '100%' }}
                >
                  <blockquote className="m-0 p-0">
                    <div className="flex gap-1 mb-4" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="w-5 h-5" style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                      ))}
                    </div>
                    
                    <p className="text-lg font-medium font-serif italic mb-6" style={{ color: 'var(--color-text)' }}>
                      "{text}"
                    </p>
                  </blockquote>
                  
                  <div className="mt-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 pt-5" style={{ borderTopColor: 'var(--color-border)' }}>
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                        {name}
                      </div>
                      <div className="text-sm font-medium mt-1" style={{ color: 'var(--color-accent)' }}>
                        {availedHome}
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section 
      aria-label="testimonials"
      className="bg-transparent relative overflow-hidden"
      style={{ margin: '1rem 0' }}
    >
      <div className="w-full relative z-10">
        <div 
          className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] h-[220px] sm:h-[280px] lg:h-[320px] overflow-hidden"
          role="region"
          aria-label="Scrolling Testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={25} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={35} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={30} />
        </div>
      </div>
    </section>
  )
}
