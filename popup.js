const siteInput = document.getElementById('siteInput')
const minutesInput = document.getElementById('minutesInput')
const siteStatus = document.getElementById('siteStatus')
const siteList = document.getElementById('siteList')

// Charger et afficher les sites bloqués
function loadBlockedSites() {
  chrome.storage.local.get('blockedSites', (data) => {
    console.log('loadBlockedSites - data reçue:', data)
    let sites = data.blockedSites || []

    // MIGRATION : Convertir ancien format (array) vers nouveau format (object)
    if (Array.isArray(sites)) {
      console.log('Migration du format array vers object')
      const newFormat = {}
      sites.forEach((site) => {
        newFormat[site] = 300000 // 5 minutes par défaut pour les anciens sites
      })
      sites = newFormat
      // Sauvegarder le nouveau format
      chrome.storage.local.set({ blockedSites: sites })
    }

    console.log('Sites à afficher:', sites)
    displaySites(sites)
  })
}

// Afficher les sites dans la liste
function displaySites(sites) {
  siteList.innerHTML = ''

  if (Object.keys(sites).length === 0) {
    siteList.innerHTML = '<p style="color: #666; font-style: italic;">Aucun site bloqué</p>'
    return
  }

  Object.entries(sites).forEach(([site, limitMs]) => {
    const limitMinutes = Math.round(limitMs / 60000)
    const siteItem = document.createElement('div')
    siteItem.className = 'site-item'
    siteItem.innerHTML = `
      <span><strong>${site}</strong> - ${limitMinutes} min</span>
      <button class="remove-btn" data-site="${site}">✕</button>
    `
    siteList.appendChild(siteItem)
  })

  // Ajouter les event listeners pour les boutons de suppression
  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const siteToRemove = e.target.getAttribute('data-site')
      removeSite(siteToRemove)
    })
  })
}

// Ajouter un nouveau site
function addSite(site, minutes) {
  if (!site || site.trim() === '') {
    siteStatus.textContent = 'Veuillez entrer un nom de domaine'
    siteStatus.style.color = 'red'
    return
  }

  if (!minutes || minutes < 1) {
    siteStatus.textContent = 'Veuillez entrer une durée valide (minimum 1 minute)'
    siteStatus.style.color = 'red'
    return
  }

  // Nettoyer le domaine (enlever http/https et www)
  site = site.trim().toLowerCase()
  site = site.replace(/^https?:\/\//, '')
  site = site.replace(/^www\./, '')
  site = site.split('/')[0] // Prendre seulement le domaine

  const limitMs = minutes * 60 * 1000

  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000 // 5 minutes par défaut
      })
      sites = newFormat
    }

    if (sites[site]) {
      siteStatus.textContent = 'Ce site est déjà dans la liste'
      siteStatus.style.color = 'orange'
      return
    }

    sites[site] = limitMs
    chrome.storage.local.set({ blockedSites: sites }, () => {
      siteStatus.innerHTML = `<strong>${site}</strong> ajouté (${minutes} min)<br/><small>⚠️ Rechargez la page ${site} pour activer le blocage</small>`
      siteStatus.style.color = 'green'
      siteInput.value = ''
      minutesInput.value = 5
      loadBlockedSites()
    })
  })
}

// Supprimer un site
function removeSite(site) {
  chrome.storage.local.get('blockedSites', (data) => {
    let sites = data.blockedSites || {}

    // Assurer la compatibilité avec l'ancien format
    if (Array.isArray(sites)) {
      const newFormat = {}
      sites.forEach((s) => {
        newFormat[s] = 300000
      })
      sites = newFormat
    }

    delete sites[site]

    chrome.storage.local.set({ blockedSites: sites }, () => {
      // IMPORTANT: Supprimer seulement le flag de blocage pour CE site
      const blockedKey = `scrollBlocked_${site}`
      chrome.storage.local.remove(blockedKey, () => {
        siteStatus.innerHTML = `<strong>${site}</strong> supprimé (blocage réinitialisé)<br/><small>⚠️ Rechargez la page ${site} pour désactiver le blocage</small>`
        siteStatus.style.color = 'green'
        console.log(`Site ${site} supprimé et ${blockedKey} réinitialisé`)
        loadBlockedSites()
      })
    })
  })
}

// Event listeners
document.getElementById('addSite').addEventListener('click', () => {
  const site = siteInput.value
  const minutes = parseInt(minutesInput.value)
  addSite(site, minutes)
})

// Permettre d'ajouter un site en appuyant sur Entrée
siteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const site = siteInput.value
    const minutes = parseInt(minutesInput.value)
    addSite(site, minutes)
  }
})

minutesInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const site = siteInput.value
    const minutes = parseInt(minutesInput.value)
    addSite(site, minutes)
  }
})

// Charger les sites au démarrage
loadBlockedSites()
