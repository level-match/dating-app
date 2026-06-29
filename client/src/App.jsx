import Background from './components/Background.jsx'
import Navbar from './components/Navbar.jsx'
import HeroSection from './components/HeroSection.jsx'
import ProcessSection from './components/ProcessSection.jsx'
import InclusivitySection from './components/InclusivitySection.jsx'
import CompatSection from './components/CompatSection.jsx'
import MatchDiscoverySection from './components/MatchDiscoverySection.jsx'
import VerificationSection from './components/VerificationSection.jsx'
import MessagingSection from './components/MessagingSection.jsx'
import RestaurantSection from './components/RestaurantSection.jsx'
import TestimonialsSection from './components/TestimonialsSection.jsx'
import CTASection from './components/CTASection.jsx'
import SocialSection from './components/SocialSection.jsx'
import AppDownloadSection from './components/AppDownloadSection.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  return (
    <div className="relative min-h-screen">
      <Background />
      <div className="relative z-10">
        <Navbar />
        {/* 1 · Hero */}
        <HeroSection />
        {/* 2 · How LEVEL Works */}
        <ProcessSection />
        {/* 3 · Why LEVEL Is Different */}
        <InclusivitySection />
        {/* 4 · Compatibility & Alignment */}
        <CompatSection />
        {/* 5 · Match Discovery preview */}
        <MatchDiscoverySection />
        {/* 6 · Professional Verification */}
        <VerificationSection />
        {/* 7 · Messaging & Introductions */}
        <MessagingSection />
        {/* 8 · Restaurant Date Planning */}
        <RestaurantSection />
        {/* 9 · Testimonials */}
        <TestimonialsSection />
        {/* 10 · Final CTA */}
        <CTASection />
        <SocialSection />
        <AppDownloadSection />
        <Footer />
      </div>
    </div>
  )
}
