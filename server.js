// server.js

const fs = require('fs').promises;
const express = require('express');
const bodyParser = require('body-parser');
const stripe = require('stripe')('your-stripe-secret-key');
const path = require('path');

const app = express();
const port = 3000;
const dbFilePath = './db.json';

// Fonction pour lire les données du fichier JSON
async function readDb() {
  try {
    const data = await fs.readFile(dbFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier JSON:', error);
    return { plastics: [], transactions: [] };  // Si le fichier n'existe pas ou est corrompu, retourner un objet vide
  }
}

// Fonction pour écrire dans le fichier JSON
async function writeDb(data) {
  try {
    await fs.writeFile(dbFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans le fichier JSON:', error);
  }
}

app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser le corps de la requête en JSON
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/recycle', (req, res) => {
  res.render('recycle');
});

// Affichage du rapport de recyclage pour une entreprise donnée
app.get('/report/:company', async (req, res) => {
  const { company } = req.params;
  const db = await readDb();
  const report = db.plastics.filter(plastic => plastic.company === company)
                            .map(plastic => ({
                              quantity: plastic.quantity,
                              recycled: plastic.recycled,
                            }));

  res.render('report', { company, report });
});

// Ajouter des plastiques recyclés
app.post('/api/recycle', async (req, res) => {
  const { company, quantity } = req.body;
  const db = await readDb();
  const newPlastic = { id: db.plastics.length + 1, company, quantity, recycled: false };
  db.plastics.push(newPlastic);
  await writeDb(db);  // Sauvegarder les changements dans le fichier JSON
  res.redirect(`/report/${company}`);
});

// Affichage de la page de transaction
app.get('/transaction', (req, res) => {
  res.render('transaction');
});

// Effectuer une transaction avec Stripe
app.post('/api/transaction', async (req, res) => {
  const { amount, token } = req.body;
  try {
    const charge = await stripe.charges.create({
      amount: amount * 100,  // Montant en centimes
      currency: 'usd',
      description: 'Plastic recycling transaction',
      source: token,
    });

    const db = await readDb();
    const newTransaction = {
      id: db.transactions.length + 1,
      amount,
      status: charge.status,
      date: new Date().toISOString(),
    };

    db.transactions.push(newTransaction);
    await writeDb(db);  // Sauvegarder les changements dans le fichier JSON
    res.redirect('/transaction');
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`EcoLoop app listening at http://localhost:${port}`);
});
