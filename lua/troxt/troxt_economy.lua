--[[
══════════════════════════════════════════════════════════════════════
  TROXT⬡ — TROXT_ECONOMY.LUA (v4.0 PLATINUM ULTIMATE)
  Système Économique RP Avancé & Macro-simulation TroxtWorld
  Marché Dynamique · Bourse & Cost Basis · Prêts & Credit Score
  Taxes · Ajustement des Taux Directeurs · Chocs d'offre/demande

  Signature : TROXT⬡
  Chemin    : C:\beni\lua\troxt\troxt_economy.lua
  Version   : 4.0.0 PLATINUM ULTIMATE
══════════════════════════════════════════════════════════════════════
]]

local Economy = {}
local Events  = require("troxt.troxt_events")
local Memory  = require("troxt.troxt_memory")

local SIG   = "TROXT⬡"
local ISIG  = "🛡️INTELLECTUS⬡"

-- ─── LOGGER DE SÉCURITÉ ──────────────────────────────────────────────────────
local function log(level, msg, data)
  local icons = { INFO="ℹ", WARN="⚠", OK="✓", ECON="💰", CRIT="🔴", TAX="💸", LOAN="📜", STOCK="📈" }
  print(string.format("[%s] %s [%s] %s", os.date("%H:%M:%S"), icons[level] or "·", SIG, msg))
  if data then
    for k, v in pairs(data) do 
      print(string.format("   ↳ %s: %s", k, tostring(v))) 
    end
  end
end

-- Helper mathématique pour arrondir proprement les transactions financières
local function round(val)
  return math.floor(val + 0.5)
end

local function count_keys(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  return n
end

-- ─── CONFIGURATION BANQUE CENTRALE ───────────────────────────────────────────
local CFG = Object.freeze and Object.freeze({
  currency_name    = "TroxtCoin",
  currency_symbol  = "T$",
  initial_supply   = 10000000,
  max_supply       = 100000000,

  base_tax_rate    = 0.12,  -- Impôt sur le revenu / ventes
  vat_rate         = 0.15,  -- Taxe sur la valeur ajoutée (TVA / TVQ)
  capital_gains    = 0.20,  -- Impôt sur les gains en capital réels
  loan_interest    = 0.08,  -- Intérêt de base des prêts bancaires (8%)
  savings_interest = 0.03,  -- Intérêt de base des comptes épargne (3%)

  inflation_target = 0.02,
  inflation_check_interval = 3600,

  max_loan_amount  = 1000000,
  min_credit_score = 400,
  max_properties   = 12,
  mortgage_rate    = 0.05,

  market_tick_sec  = 300,
  price_volatility = 0.05,
}) or {
  currency_name = "TroxtCoin", currency_symbol = "T$",
  initial_supply = 10000000, max_supply = 100000000,
  base_tax_rate = 0.12, vat_rate = 0.15, capital_gains = 0.20,
  loan_interest = 0.08, savings_interest = 0.03,
  inflation_target = 0.02, inflation_check_interval = 3600,
  max_loan_amount = 1000000, min_credit_score = 400,
  max_properties = 12, mortgage_rate = 0.05,
  market_tick_sec = 300, price_volatility = 0.05,
}

-- ─── CONFIGURATION PRODUITS DU MARCHÉ ────────────────────────────────────────
local MARKET_ITEMS = {
  acier         = { base_price=120,   category="matiere",    volatility=0.04, supply=1000 },
  bois          = { base_price=45,    category="matiere",    volatility=0.03, supply=2000 },
  carburant     = { base_price=80,    category="energie",    volatility=0.08, supply=800  },
  electronique  = { base_price=350,   category="tech",       volatility=0.06, supply=400  },
  medicaments   = { base_price=200,   category="sante",      volatility=0.02, supply=600  },
  drogue_rue    = { base_price=500,   category="illegal",    volatility=0.15, supply=200, illegal=true },
  arme_ill      = { base_price=1500,  category="illegal",    volatility=0.20, supply=50,  illegal=true },
  sandwich      = { base_price=15,    category="nourriture", volatility=0.01, supply=5000 },
  bouteille_eau = { base_price=5,     category="nourriture", volatility=0.01, supply=8000 },
  voiture_base  = { base_price=25000, category="vehicule",   volatility=0.02, supply=100  },
  moto          = { base_price=15000, category="vehicule",   volatility=0.03, supply=80   },
  camion        = { base_price=60000, category="vehicule",   volatility=0.02, supply=30   },
  appart_1p     = { base_price=180000,category="immobilier", volatility=0.01, supply=50 },
  appart_2p     = { base_price=280000,category="immobilier", volatility=0.01, supply=30 },
  maison        = { base_price=450000,category="immobilier", volatility=0.01, supply=20 },
  entrepot      = { base_price=350000,category="immobilier", volatility=0.02, supply=15 },
}

-- ─── ÉTAT ÉCONOMIQUE DE LA MATRICE ───────────────────────────────────────────
local _state = {
  money_supply         = CFG.initial_supply,
  inflation_rate       = 0.0,
  gdp                  = 0,
  unemployment_pct     = 5.0,
  last_inflation_check = os.time(),

  prices               = {},
  price_history        = {},
  market_volumes       = {},

  treasury             = 5000000, -- Fond de départ du Trésor Public
  taxes_collected      = 0,
  subsidies_paid       = 0,
  loans_outstanding    = 0,

  properties           = {},
  mortgage_pool        = {},
  credit_scores        = {},      -- ✨ v4.0 : Pointage de crédit par joueur { [player_id] = score }

  stocks               = {},
  stock_history        = {},

  active_shocks        = {},      -- ✨ v4.0 : Chocs d'offre/demande liés à ThirdEye { [category] = multiplier }

  -- Taux directeurs fluctuants (Monetary Policy)
  current_loan_interest    = CFG.loan_interest,
  current_savings_interest = CFG.savings_interest,

  daily = {
    transactions = 0,
    volume       = 0,
    taxes        = 0,
    date         = os.date("%Y-%m-%d"),
  },
}

-- ─── INITIALISATEURS ─────────────────────────────────────────────────────────
local function init_prices()
  for id, item in pairs(MARKET_ITEMS) do
    _state.prices[id]         = item.base_price
    _state.price_history[id]  = { { price=item.base_price, ts=os.time() } }
    _state.market_volumes[id] = 0
  end
end

local LISTED_STOCKS = {
  TROXT_POLICE  = { name="Sûreté Troxt Corp",  price=100, shares=100000, dividend=0.02 },
  TROXT_MEDIC   = { name="TroxtMedical Inc",   price=85,  shares=200000, dividend=0.03 },
  TROXT_GARAGE  = { name="TroxtGarage Ltd",    price=50,  shares=500000, dividend=0.04 },
  TROXT_IMMO    = { name="TroxtImmobilier SA", price=200, shares=50000,  dividend=0.025 },
  TROXT_FOOD    = { name="TroxtFood Group",    price=35,  shares=800000, dividend=0.05 },
}

local function init_stocks()
  for ticker, def in pairs(LISTED_STOCKS) do
    _state.stocks[ticker] = {
      ticker       = ticker,
      name         = def.name,
      price        = def.price,
      open_price   = def.price,
      high         = def.price,
      low          = def.price,
      volume       = 0,
      shares_total = def.shares,
      shares_float = math.floor(def.shares * 0.7),
      dividend_pct = def.dividend,
      holders      = {}, -- ✨ v4.0 : { [player_id] = { shares=N, avg_price=P } } (Cost Basis)
    }
    _state.stock_history[ticker] = {}
  end
end

-- ─── AMORÇAGE ET CHARGEMENT DE LA MÉMOIRE ────────────────────────────────────
function Economy.init()
  local saved
  local ok, res = pcall(Memory.get, "economy:state")
  if ok and type(res) == "table" then saved = res end

  if saved then
    for k, v in pairs(saved) do _state[k] = v end
  end

  if not _state.prices or count_keys(_state.prices) == 0 then
    init_prices()
  end
  if not _state.stocks or count_keys(_state.stocks) == 0 then
    init_stocks()
  end

  _state.stock_history = _state.stock_history or {}
  for ticker, _ in pairs(_state.stocks) do
    _state.stock_history[ticker] = _state.stock_history[ticker] or {}
  end

  _state.mortgage_pool    = _state.mortgage_pool or {}
  _state.properties       = _state.properties or {}
  _state.credit_scores    = _state.credit_scores or {}
  _state.active_shocks    = _state.active_shocks or {}
  _state.daily            = _state.daily or { transactions=0, volume=0, taxes=0, date=os.date("%Y-%m-%d") }
  
  _state.current_loan_interest    = _state.current_loan_interest or CFG.loan_interest
  _state.current_savings_interest = _state.current_savings_interest or CFG.savings_interest

  log("OK", string.format("Économie initialisée — Trésor : %dT$ — %d articles de marché",
    _state.treasury, count_keys(_state.prices)))

  Events.emit("troxtworld:economy_ready", {
    supply = _state.money_supply,
    items  = count_keys(_state.prices),
    sig    = SIG,
  })
end

-- ─── INTÉGRATION THIRDEYE : CHOCS MACROÉCONOMIQUES ───────────────────────────
function Economy.apply_world_shock(category, price_multiplier, duration_sec)
  _state.active_shocks[category] = {
    multiplier = price_multiplier,
    expires_at = os.time() + (duration_sec or 600),
  }
  log("WARN", string.format("Choc de marché actif sur la catégorie [%s] : Prix x%.2f",
    category, price_multiplier))
  Events.emit("troxtworld:economic_shock", { category = category, multiplier = price_multiplier, sig = SIG })
end

-- ─── TICK DE SIMULATION DE MARCHÉ (5 min) ────────────────────────────────────
function Economy.tick_market()
  local now       = os.time()
  local today     = os.date("%Y-%m-%d")
  local updated   = 0

  -- Réinitialisation des volumes quotidiens
  local reset_day = _state.daily.date ~= today
  if reset_day then
    for id, _ in pairs(MARKET_ITEMS) do
      _state.market_volumes[id] = 0
    end
  end

  -- Nettoyage des chocs expirés
  for cat, shock in pairs(_state.active_shocks) do
    if now >= shock.expires_at then
      _state.active_shocks[cat] = nil
      log("INFO", string.format("Fin du choc d'offre sur la catégorie [%s] — Normalisation.", cat))
    end
  end

  for id, item in pairs(MARKET_ITEMS) do
    local current = _state.prices[id] or item.base_price
    local vol     = item.volatility or CFG.price_volatility

    local supply  = item.supply or 1000
    local demand  = (_state.market_volumes[id] or 0)
    
    -- Calcul de la pression de la demande
    local pressure = demand > supply * 0.5 and 1.01 or demand < supply * 0.1 and 0.99 or 1.0
    local random_factor = 1 + (math.random() - 0.5) * vol * 2

    -- Intégration du choc ThirdEye
    local shock_factor = 1.0
    if _state.active_shocks[item.category] then
      shock_factor = _state.active_shocks[item.category].multiplier
    end

    local new_price = round(current * random_factor * pressure * shock_factor)
    
    -- Empêche les dérives hyper-inflationnistes ou l'effondrement total
    local base = item.base_price
    new_price = math.max(round(base * 0.4), math.min(round(base * 3.5), new_price))

    if new_price ~= current then
      _state.prices[id] = new_price
      _state.price_history[id] = _state.price_history[id] or {}
      table.insert(_state.price_history[id], { price=new_price, ts=now })
      if #_state.price_history[id] > 50 then table.remove(_state.price_history[id], 1) end
      updated = updated + 1
    end
  end

  Economy.tick_stocks()
  Economy.check_inflation()
  _state.daily.date = today

  Events.emit("troxtworld:market_tick", {
    updated = updated,
    prices  = _state.prices,
    sig     = SIG,
  })
end

-- ─── TICK DE LA BOURSE (Fluctuation des actions) ─────────────────────────────
function Economy.tick_stocks()
  local now = os.time()
  for ticker, stock in pairs(_state.stocks) do
    local vol    = 0.03 + math.random() * 0.04
    local factor = 1 + (math.random() - 0.5) * vol * 2
    
    -- Pression boursière liée au volume d'échange
    local pressure = 1.0
    if stock.volume > stock.shares_total * 0.05 then
      pressure = 1.015 -- Hausse si gros volume d'achat
    elseif stock.volume == 0 then
      pressure = 0.99 -- Baisse lente si stagnation
    end

    local new_price = math.max(5, round(stock.price * factor * pressure))

    stock.high   = math.max(stock.high, new_price)
    stock.low    = math.min(stock.low,  new_price)
    stock.price  = new_price
    stock.volume = 0 -- Reset du volume après le tick

    _state.stock_history[ticker] = _state.stock_history[ticker] or {}
    table.insert(_state.stock_history[ticker], { price=new_price, ts=now })
    if #_state.stock_history[ticker] > 60 then
      table.remove(_state.stock_history[ticker], 1)
    end
  end
end

-- ─── ACHETER AU MARCHÉ (TVA & Trésor) ────────────────────────────────────────
function Economy.buy(player_id, item_id, quantity, player_cash, is_illegal_allowed)
  local item = MARKET_ITEMS[item_id]
  if not item then return false, "Article introuvable" end
  if item.illegal and not is_illegal_allowed then
    return false, "Acquisition illégale bloquée — Marché noir introuvable"
  end

  local price    = _state.prices[item_id] or item.base_price
  local subtotal = price * quantity
  local vat      = round(subtotal * CFG.vat_rate)
  local total    = subtotal + vat

  if player_cash < total then
    return false, string.format("Liquidités de poche insuffisantes — Requis : %dT$", total)
  end

  _state.market_volumes[item_id] = (_state.market_volumes[item_id] or 0) + quantity
  _state.treasury           = _state.treasury + vat
  _state.taxes_collected    = _state.taxes_collected + vat
  _state.daily.transactions = _state.daily.transactions + 1
  _state.daily.volume       = _state.daily.volume + subtotal
  _state.daily.taxes        = _state.daily.taxes + vat

  log("ECON", string.format("ACHAT — %s a acheté %d [%s] pour %dT$ (TVA %dT$)",
    player_id, quantity, item_id, subtotal, vat))

  Events.emit("troxtworld:market_buy", {
    player_id = player_id,
    item_id   = item_id,
    quantity  = quantity,
    price     = price,
    subtotal  = subtotal,
    vat       = vat,
    total     = total,
    sig       = SIG,
  })

  return true, { cost=total, subtotal=subtotal, vat=vat, price=price }
end

-- ─── VENDRE AU MARCHÉ (Impôts directs) ───────────────────────────────────────
function Economy.sell(player_id, item_id, quantity)
  local item = MARKET_ITEMS[item_id]
  if not item then return false, "Article introuvable" end

  local price    = math.floor((_state.prices[item_id] or item.base_price) * 0.85)
  local revenue  = price * quantity
  local tax      = round(revenue * CFG.base_tax_rate)
  local net      = revenue - tax

  _state.treasury         = _state.treasury + tax
  _state.taxes_collected  = _state.taxes_collected + tax
  _state.daily.volume     = _state.daily.volume + revenue

  log("ECON", string.format("VENTE — %s a vendu %d [%s]. Net perçu : %dT$ (Taxe : %dT$)",
    player_id, quantity, item_id, net, tax))

  Events.emit("troxtworld:market_sell", {
    player_id = player_id,
    item_id   = item_id,
    quantity  = quantity,
    price     = price,
    revenue   = revenue,
    tax       = tax,
    net       = net,
    sig       = SIG,
  })

  return true, { revenue=revenue, tax=tax, net=net, price=price }
end

-- ─── BOURSE : ACHAT AVEC COST BASIS (v4.0) ───────────────────────────────────
function Economy.buy_stock(player_id, ticker, shares, player_bank)
  local stock = _state.stocks[ticker]
  if not stock then return false, "Titre boursier introuvable" end
  if shares > stock.shares_float then return false, "Volume flottant d'actions insuffisant" end

  local cost  = stock.price * shares
  local fee   = round(cost * 0.005) -- Commission de courtage 0.5%
  local total = cost + fee

  if player_bank < total then return false, "Solde de votre compte bancaire insuffisant" end

  stock.shares_float = stock.shares_float - shares
  stock.volume       = stock.volume + shares

  -- Suivi du prix d'achat moyen (Cost Basis) pour taxation équitable
  stock.holders[player_id] = stock.holders[player_id] or { shares = 0, avg_price = 0 }
  local wallet = stock.holders[player_id]
  
  local previous_cost = wallet.shares * wallet.avg_price
  local current_cost  = shares * stock.price
  wallet.shares       = wallet.shares + shares
  wallet.avg_price    = round((previous_cost + current_cost) / wallet.shares)

  _state.treasury = _state.treasury + fee

  log("STOCK", string.format("ACHAT ACTION — %s : %d %s @ %dT$. Cost-Basis : %dT$/sh",
    player_id, shares, ticker, stock.price, wallet.avg_price))

  Events.emit("troxtworld:stock_buy", {
    player_id=player_id, ticker=ticker, shares=shares, price=stock.price,
    cost=cost, fee=fee, total=total, sig=SIG,
  })

  return true, { cost=cost, fee=fee, total=total, price=stock.price }
end

-- ─── BOURSE : VENTE AVEC TAXE SUR GAIN RÉEL (v4.0) ───────────────────────────
function Economy.sell_stock(player_id, ticker, shares)
  local stock = _state.stocks[ticker]
  if not stock then return false, "Titre boursier introuvable" end
  
  local wallet = stock.holders[player_id]
  if not wallet or wallet.shares < shares then 
    return false, string.format("Volume d'actions insuffisant (%d/%d)", wallet and wallet.shares or 0, shares) 
  end

  local revenue  = stock.price * shares
  local fee      = round(revenue * 0.005)

  -- Calcul de la taxe sur la plus-value réelle (Capital Gains)
  local profit = (stock.price - wallet.avg_price) * shares
  local gain_tax = 0
  if profit > 0 then
    gain_tax = round(profit * CFG.capital_gains)
  end

  local net = revenue - fee - gain_tax

  stock.shares_float = stock.shares_float + shares
  stock.volume       = stock.volume + shares
  
  wallet.shares = wallet.shares - shares
  if wallet.shares <= 0 then
    stock.holders[player_id] = nil
  end

  _state.treasury = _state.treasury + fee + gain_tax

  log("STOCK", string.format("VENTE ACTION — %s : %d %s @ %dT$. Plus-value : %dT$ (Impôt : %dT$)",
    player_id, shares, ticker, stock.price, profit, gain_tax))

  Events.emit("troxtworld:stock_sell", {
    player_id=player_id, ticker=ticker, shares=shares, price=stock.price,
    revenue=revenue, fee=fee, gain_tax=gain_tax, net=net, sig=SIG,
  })

  return true, { revenue=revenue, fee=fee, gain_tax=gain_tax, net=net }
end

-- ─── MOYENNE DE VERSEMENT DE DIVIDENDES (v4.0) ───────────────────────────────
function Economy.pay_dividends()
  local paid = 0
  local count = 0
  for ticker, stock in pairs(_state.stocks) do
    for player_id, wallet in pairs(stock.holders) do
      if wallet.shares > 0 then
        local div_payout = round(wallet.shares * (stock.price * stock.dividend_pct))
        if div_payout > 0 then
          paid = paid + div_payout
          count = count + 1
          -- L'appelant doit créditer la banque du joueur de `div_payout`
          Events.emit("troxtworld:dividend_payout", {
            player_id = player_id, ticker = ticker, amount = div_payout, sig = SIG
          })
        end
      end
    end
  end
  log("STOCK", string.format("Dividendes distribués — %dT$ versés à %d actionnaires.", paid, count))
  return paid, count
end

-- ─── PRÊTS BANCAIRES AVEC POINTAGE DE CRÉDIT (v4.0) ──────────────────────────
function Economy.get_credit_score(player_id)
  if not _state.credit_scores[player_id] then
    _state.credit_scores[player_id] = 600 -- Score de départ neutre
  end
  return _state.credit_scores[player_id]
end

function Economy.request_loan(player_id, amount)
  local score = Economy.get_credit_score(player_id)
  
  if amount > CFG.max_loan_amount then
    return false, string.format("Le montant maximum d'emprunt autorisé est de %dT$", CFG.max_loan_amount)
  end
  if score < CFG.min_credit_score then
    return false, string.format("Dossier de crédit rejeté (%d/%d requis)", score, CFG.min_credit_score)
  end

  -- Calcul d'un taux d'intérêt préférentiel basé sur la qualité de crédit
  local risk_premium = (850 - score) / 600 * 0.06 -- Jusqu'à +6% pour les mauvais payeurs
  local final_rate   = _state.current_loan_interest + risk_premium

  local monthly_rate    = final_rate / 12
  local months          = 12
  local monthly_payment = round(amount * monthly_rate / (1 - (1 + monthly_rate)^(-months)))
  local loan_id         = string.format("LN-%s-%d", player_id:sub(1,6), os.time())

  _state.mortgage_pool[loan_id] = {
    id               = loan_id,
    player_id        = player_id,
    principal        = amount,
    balance          = amount,
    monthly_payment  = monthly_payment,
    rate             = final_rate,
    months_remaining = months,
    issued_at        = os.time(),
    active           = true,
    sig              = SIG,
  }

  _state.loans_outstanding = _state.loans_outstanding + amount

  log("LOAN", string.format("PRÊT ACCORDÉ — %s : %dT$ @ %.2f%%. Traite mensuelle : %dT$/mois",
    player_id, amount, final_rate * 100, monthly_payment))

  Events.emit("troxtworld:loan_issued", {
    player_id=player_id, loan_id=loan_id, amount=amount,
    monthly=monthly_payment, months=months, rate=final_rate, sig=SIG,
  })

  return true, { loan_id=loan_id, amount=amount, monthly=monthly_payment, months=months, rate=final_rate }
end

function Economy.pay_loan(loan_id, player_id)
  local loan = _state.mortgage_pool[loan_id]
  if not loan or not loan.active then return false, "Prêt introuvable ou inactif" end
  if loan.player_id ~= player_id then return false, "Ce prêt n'est pas associé à votre identifiant" end

  local payment   = loan.monthly_payment
  local interest  = round(loan.balance * (loan.rate / 12))
  local principal = payment - interest

  loan.balance          = math.max(0, loan.balance - principal)
  loan.months_remaining = loan.months_remaining - 1
  _state.treasury       = _state.treasury + interest

  -- Évolution positive du pointage de crédit lors des versements
  _state.credit_scores[player_id] = math.min(850, Economy.get_credit_score(player_id) + 5)

  if loan.balance <= 0 or loan.months_remaining <= 0 then
    loan.active = false
    _state.loans_outstanding = math.max(0, _state.loans_outstanding - loan.principal)
    -- Grosse bonification pour remboursement total
    _state.credit_scores[player_id] = math.min(850, Economy.get_credit_score(player_id) + 30)
    Events.emit("troxtworld:loan_repaid", { loan_id=loan_id, player_id=player_id, sig=SIG })
  end

  return true, { paid=payment, interest=interest, principal=principal, balance=loan.balance }
end

-- ─── INFLATION & GESTION DES TAUX DIRECTEURS (v4.0) ──────────────────────────
function Economy.check_inflation()
  local now = os.time()
  if now - _state.last_inflation_check < CFG.inflation_check_interval then return end
  _state.last_inflation_check = now

  local gdp_estimate = _state.daily.volume * 30
  local velocity     = gdp_estimate > 0 and (_state.money_supply / gdp_estimate) or 1

  local raw_inflation = (velocity - 1) * 0.05
  _state.inflation_rate = math.max(-0.02, math.min(0.20, raw_inflation))

  -- Politique monétaire de la Banque Centrale (Stabilisation)
  if _state.inflation_rate > 0.05 then
    -- Hausse des taux directeurs pour ralentir les emprunts (politique restrictive)
    _state.current_loan_interest    = math.min(0.25, CFG.loan_interest + 0.04)
    _state.current_savings_interest = math.min(0.12, CFG.savings_interest + 0.02)
    log("WARN", string.format("HAUTE INFLATION (%.1f%%) — Banque Centrale augmente les taux d'intérêt.", _state.inflation_rate * 100))
  elseif _state.inflation_rate < -0.01 then
    -- Baisse des taux pour relancer la vélocité de la monnaie (politique expansionniste)
    _state.current_loan_interest    = math.max(0.04, CFG.loan_interest - 0.02)
    _state.current_savings_interest = math.max(0.01, CFG.savings_interest - 0.015)
    log("INFO", string.format("DEFLATION DETECTEE (%.1f%%) — Relance de la Banque Centrale par baisse des taux.", _state.inflation_rate * 100))
  else
    _state.current_loan_interest    = CFG.loan_interest
    _state.current_savings_interest = CFG.savings_interest
  end

  if math.abs(_state.inflation_rate) > 0.05 then
    Events.emit("troxtworld:inflation_alert", {
      rate=_state.inflation_rate, supply=_state.money_supply, sig=SIG
    })
    
    -- Ajustement direct sur les étiquettes de prix du marché
    for id, _ in pairs(_state.prices) do
      _state.prices[id] = round(_state.prices[id] * (1 + _state.inflation_rate * 0.1))
    end
  end
end

-- ─── TAXATION ET WELFARE (SUBVENTIONS) ───────────────────────────────────────
function Economy.collect_tax(amount, tax_type)
  if amount <= 0 then return 0 end
  local tax_rates = {
    income   = CFG.base_tax_rate,
    vat      = CFG.vat_rate,
    capital  = CFG.capital_gains,
    property = 0.01,
    luxury   = 0.25,
  }
  local rate = tax_rates[tax_type] or CFG.base_tax_rate
  local tax  = round(amount * rate)
  _state.treasury        = _state.treasury + tax
  _state.taxes_collected = _state.taxes_collected + tax
  _state.daily.taxes     = _state.daily.taxes + tax
  return tax
end

function Economy.distribute_subsidy(player_id, amount, reason)
  if amount <= 0 then return false, "Montant invalide" end
  if _state.treasury < amount then
    return false, "Trésor public insolvable — Subventions suspendues"
  end

  _state.subsidies_paid = _state.subsidies_paid + amount
  _state.treasury       = _state.treasury - amount
  
  Events.emit("troxtworld:subsidy_paid", { player_id=player_id, amount=amount, reason=reason, sig=SIG })
  return true
end

-- ─── RAPPORTS DE TÉLÉMÉTRIE MACROÉCONOMIQUES ─────────────────────────────────
function Economy.get_report()
  local stock_count = count_keys(_state.stocks)
  local item_count  = count_keys(MARKET_ITEMS)

  local top_list = {}
  for id, vol in pairs(_state.market_volumes) do
    if vol > 0 then table.insert(top_list, { id=id, volume=vol, price=_state.prices[id] }) end
  end
  table.sort(top_list, function(a, b) return a.volume > b.volume end)
  
  local top5 = {}
  for i = 1, math.min(5, #top_list) do table.insert(top5, top_list[i]) end

  local total_price = 0
  for _, s in pairs(_state.stocks) do total_price = total_price + s.price end

  return {
    sig          = SIG,
    currency     = CFG.currency_name .. " (" .. CFG.currency_symbol .. ")",
    generated_at = os.date("%Y-%m-%d %H:%M:%S"),
    macro = {
      money_supply      = _state.money_supply,
      inflation_rate    = string.format("%.2f%%", (_state.inflation_rate or 0) * 100),
      treasury          = _state.treasury,
      taxes_collected   = _state.taxes_collected,
      loans_outstanding = _state.loans_outstanding,
      loan_rate         = string.format("%.2f%%", _state.current_loan_interest * 100),
      savings_rate      = string.format("%.2f%%", _state.current_savings_interest * 100),
    },
    daily  = _state.daily,
    market = { items = item_count, top_volume = top5 },
    stocks = {
      listed = stock_count,
      index  = math.floor(total_price / math.max(1, stock_count)),
    },
  }
end

function Economy.get_prices()       return _state.prices end
function Economy.get_price(item_id) return _state.prices[item_id] end
function Economy.get_stocks()       return _state.stocks end
function Economy.get_stock(ticker)  return _state.stocks[ticker] end
function Economy.get_market_items() return MARKET_ITEMS end
function Economy.get_treasury()     return _state.treasury end
function Economy.get_signature()    return SIG end

-- ─── FLUSH PHYSIQUE DE L'ÉTAT (SAUVEGARDE) ───────────────────────────────────
function Economy.save()
  Memory.set("economy:state", {
    money_supply             = _state.money_supply,
    inflation_rate           = _state.inflation_rate,
    treasury                 = _state.treasury,
    taxes_collected          = _state.taxes_collected,
    loans_outstanding        = _state.loans_outstanding,
    current_loan_interest    = _state.current_loan_interest,
    current_savings_interest = _state.current_savings_interest,
    prices                   = _state.prices,
    price_history            = _state.price_history,
    market_volumes           = _state.market_volumes,
    stocks                   = _state.stocks,
    stock_history            = _state.stock_history,
    mortgage_pool            = _state.mortgage_pool,
    credit_scores            = _state.credit_scores,
    daily                    = _state.daily,
  })
end

Economy.init()
return Economy