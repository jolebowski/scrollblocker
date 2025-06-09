const input = document.getElementById('minutes')
const status = document.getElementById('status')
const siteInput = document.getElementById('siteInput')
const siteStatus = document.getElementById('siteStatus')
const siteList = document.getElementById('siteList')

// Charger la valeur actuelle du temps
chrome.storage.local.get('scrollTimeLimit', (data) => {
  const ms = data.scrollTimeLimit ?? 60000
  input.value = ms / 60000
  console.log(`Valeur chargée depuis chrome.storage : ${ms} ms`)
})

// Charger et afficher les sites bloqués
function loadBlockedSites() {
  chrome.storage.local.get('blockedSites', (data) => {
    console.log('loadBlockedSites - data reçue:', data)
    const sites = data.blockedSites || []
    console.log('Sites à afficher:', sites)
    displaySites(sites)
  })
}

// Afficher les sites dans la liste
function displaySites(sites) {
  siteList.innerHTML = ''
  sites.forEach((site) => {
    const siteItem = document.createElement('div')
    siteItem.className = 'site-item'
    siteItem.innerHTML = `
      <span>${site}</span>
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
function addSite(site) {
  if (!site || site.trim() === '') {
    siteStatus.textContent = 'Veuillez entrer un nom de domaine'
    siteStatus.style.color = 'red'
    return
  }

  // Nettoyer le domaine (enlever http/https et www)
  site = site.trim().toLowerCase()
  site = site.replace(/^https?:\/\//, '')
  site = site.replace(/^www\./, '')
  site = site.split('/')[0] // Prendre seulement le domaine

  chrome.storage.local.get('blockedSites', (data) => {
    const sites = data.blockedSites || []

    if (sites.includes(site)) {
      siteStatus.textContent = 'Ce site est déjà dans la liste'
      siteStatus.style.color = 'orange'
      return
    }

    sites.push(site)
    chrome.storage.local.set({ blockedSites: sites }, () => {
      siteStatus.innerHTML = `<strong>${site}</strong> ajouté avec succès<br/><small>⚠️ Rechargez la page ${site} pour activer le blocage</small>`
      siteStatus.style.color = 'green'
      siteInput.value = ''
      loadBlockedSites()
    })
  })
}

// Supprimer un site
function removeSite(site) {
  chrome.storage.local.get('blockedSites', (data) => {
    const sites = data.blockedSites || []
    const updatedSites = sites.filter((s) => s !== site)

    chrome.storage.local.set({ blockedSites: updatedSites }, () => {
      // IMPORTANT: Quand on enlève un site, on reset aussi le flag de blocage
      chrome.storage.local.remove('scrollBlocked', () => {
        siteStatus.innerHTML = `<strong>${site}</strong> supprimé (blocage réinitialisé)<br/><small>⚠️ Rechargez la page ${site} pour désactiver le blocage</small>`
        siteStatus.style.color = 'green'
        console.log(`Site ${site} supprimé et scrollBlocked réinitialisé`)
        loadBlockedSites()
      })
    })
  })
}

// Event listeners
document.getElementById('save').addEventListener('click', () => {
  const mins = parseInt(input.value)
  const ms = mins * 60 * 1000
  chrome.storage.local.set({ scrollTimeLimit: ms }, () => {
    chrome.storage.local.remove('scrollBlocked')
    console.log(`Nouvelle valeur enregistrée : ${ms} ms`)
    status.innerHTML = `Limite définie à <strong>${mins} minute(s)</strong><br/><small>⚠️ Rechargez les pages des sites bloqués pour appliquer la nouvelle limite</small>`
    status.style.color = 'green'
  })
})

document.getElementById('addSite').addEventListener('click', () => {
  addSite(siteInput.value)
})

// Permettre d'ajouter un site en appuyant sur Entrée
siteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSite(siteInput.value)
  }
})

// Charger les sites au démarrage
loadBlockedSites()
