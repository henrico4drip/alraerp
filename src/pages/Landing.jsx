import React from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        body { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); background-color: #4ba3e3; color: white; overflow-x: hidden; }
        .main-wrapper { background: linear-gradient(180deg, #4fa6dd 0%, #5eaef5 40%, #6db8f9 100%); min-height: 100vh; position: relative; padding-bottom: 50px; }
        header { display: flex; justify-content: space-between; align-items: center; padding: clamp(12px, 2vw, 20px) 5%; max-width: 1200px; margin: 0 auto; }
        .logo { font-size: clamp(1rem, 2vw + 0.5rem, 2rem); font-weight: 800; }
        .logo span { font-weight: 300; font-size: clamp(0.5rem, 1.2vw, 0.9rem); }
        .nav-links a { color: white; text-decoration: none; margin-left: clamp(12px, 2vw, 25px); font-weight: 500; font-size: clamp(0.85rem, 1.2vw, 1rem); }
        .nav-links .btn-link { text-decoration: underline; }
        .hero { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: clamp(24px, 3vw, 40px) 5%; max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
        .hero-text { flex: 1; min-width: 300px; max-width: 600px; }
        .hero-text h1 { font-size: clamp(2rem, 4vw + 1rem, 3.5rem); line-height: 1.2; font-weight: 700; margin-bottom: clamp(12px, 2vw, 20px); }
        .hero-text p { font-size: clamp(1rem, 1.5vw, 1.2rem); margin-bottom: clamp(18px, 2.5vw, 30px); font-weight: 300; opacity: 0.9; }
        .btn-cta { background-color: #76cc2e; color: white; padding: clamp(10px, 1.5vw, 15px) clamp(22px, 3vw, 35px); border-radius: clamp(30px, 4vw, 50px); text-decoration: none; font-weight: 700; font-size: clamp(0.9rem, 1.3vw, 1rem); box-shadow: 0 5px 15px rgba(118, 204, 46, 0.4); transition: transform 0.2s, background 0.2s; display: inline-block; text-transform: uppercase; }
        .btn-cta:hover { transform: translateY(-3px); background-color: #65b025; }
        .hero-image { flex: 1; min-width: 300px; display: flex; justify-content: center; position: relative; }
        .hero-image img { max-width: min(100%, 560px); height: auto; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.15)); }
        .wave-container { position: relative; width: 100%; overflow: hidden; line-height: 0; margin-top: -50px; z-index: 1; opacity: 0.3; }
        .wave-container svg { position: relative; display: block; width: calc(100% + 1.3px); height: 150px; }
        .wave-container .shape-fill { fill: #FFFFFF; }
        .features-section { padding: 20px 5%; max-width: 1200px; margin: 0 auto; }
        .section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: clamp(24px, 3vw, 40px); flex-wrap: wrap; gap: clamp(12px, 2vw, 20px); }
        .section-header div { max-width: 500px; }
        .section-header h3 { font-size: clamp(1rem, 1.5vw, 1.1rem); font-weight: 600; margin-bottom: 5px; }
        .section-header p { font-size: clamp(0.85rem, 1.2vw, 0.9rem); opacity: 0.8; }
        .badge-tag { background-color: rgba(255,255,255,0.2); padding: clamp(6px, 1vw, 8px) clamp(14px, 2vw, 20px); border-radius: clamp(14px, 2vw, 20px); font-size: clamp(0.8rem, 1.2vw, 0.9rem); backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.3); }
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
        .card { background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 15px; padding: 30px; transition: transform 0.3s; display: flex; flex-direction: column; align-items: flex-start; }
        .card:hover { transform: translateY(-5px); background: rgba(255, 255, 255, 0.25); }
        .card-icon { font-size: clamp(1.4rem, 2.2vw, 2rem); margin-bottom: clamp(10px, 1.5vw, 15px); color: #fff; opacity: 0.8; }
        .card h4 { font-size: clamp(1rem, 1.6vw, 1.2rem); margin-bottom: clamp(8px, 1.2vw, 10px); font-weight: 600; }
        .card p { font-size: clamp(0.85rem, 1.2vw, 0.9rem); line-height: 1.5; opacity: 0.8; font-weight: 300; }
        footer { text-align: center; padding: 40px 20px; font-size: 0.8rem; opacity: 0.7; margin-top: 40px; }
        @media (max-width: 768px) { .hero-text h1 { font-size: 2.5rem; } .hero { flex-direction: column-reverse; text-align: center; gap: 40px; } .section-header { flex-direction: column; align-items: center; text-align: center; } .nav-links { display: flex; gap: 15px; } .nav-links a { margin-left: 0; font-size: 0.9rem; } }
      `}</style>
      <div className="main-wrapper">
        <header>
          <div className="logo">alra <span style={{ verticalAlign: 'super', fontSize: '0.6rem' }}>erp+</span></div>
          <nav className="nav-links">
            <Link to="/login">Login</Link>
            <Link to="/support">Suporte</Link>
            <Link to="/billing">Planos</Link>
            <Link to="/login" className="btn-link">Cadastre-se</Link>
          </nav>
        </header>
        <section className="hero">
          <div className="hero-text">
            <h1>MEI, impulsione suas vendas e fidelize clientes!</h1>
            <p>Com alra erp+ você oferece cashback e vê seu negócio crescer.</p>
            <Link to="/login" className="btn-cta">EXPERIMENTE GRÁTIS</Link>
          </div>
          <div className="hero-image">
            <img src="https://cdni.iconscout.com/illustration/premium/thumb/online-shopping-store-2974945-2477378.png" alt="Lojista vendendo" />
          </div>
        </section>
        <div className="wave-container">
          <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M985.66,92.83C906.67,72,823.78,31,432.84,37.88a1035.54,1035.54,0,0,0-199,23c-50,9.36-147.32,31-233.84,71.12V0H1200V120C1152.31,114.2,1076.49,116.87,985.66,92.83Z" className="shape-fill" opacity="0.3"></path>
          </svg>
        </div>
        <section className="features-section">
          <div className="section-header">
            <div>
              <h3>Sua empresa com muito mais clientes e muito mais controle!</h3>
              <p>Experimente alra erp+ e veja suas vendas escalarem.</p>
            </div>
            <div className="badge-tag">Um sistema moderno, limpo, e intuitivo</div>
          </div>
          <div className="cards-grid">
            <div className="card">
              <i className="fas fa-chart-line card-icon"></i>
              <h4>Relatórios Inteligentes</h4>
              <p>Tome decisões baseadas em dados com relatórios detalhados sobre todas as áreas do seu negócio.</p>
            </div>
            <div className="card">
              <i className="fas fa-cash-register card-icon"></i>
              <h4>PDV Ágil</h4>
              <p>Realize vendas em segundos com nosso sistema de caixa otimizado para o dia a dia do varejo.</p>
            </div>
            <div className="card">
              <i className="fas fa-users card-icon"></i>
              <h4>Gestão de Clientes</h4>
              <p>Saiba quem são seus melhores clientes e crie campanhas de fidelidade automáticas.</p>
            </div>
            <div className="card">
              <i className="fas fa-box-open card-icon"></i>
              <h4>Controle de Estoque</h4>
              <p>Evite furos no estoque com alertas automáticos e gestão simplificada de entrada e saída.</p>
            </div>
            <div className="card">
              <i className="fas fa-bullhorn card-icon"></i>
              <h4>Marketing Integrado</h4>
              <p>Envie promoções e novidades para seus clientes diretamente pela plataforma.</p>
            </div>
            <div className="card">
              <i className="fas fa-file-invoice-dollar card-icon"></i>
              <h4>Emissão Fiscal</h4>
              <p>Emita notas fiscais (NFC-e e NF-e) de forma descomplicada e automática.</p>
            </div>
          </div>
        </section>
        <footer>© {new Date().getFullYear()} AlraERP+. Todos os direitos reservados.</footer>
      </div>
    </>
  )
}
