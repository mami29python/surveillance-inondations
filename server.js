const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(express.json());

// 1. Initialisation de la base de données SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("Erreur d'ouverture de la base de données", err.message);
    } else {
        console.log("Connecté à la base de données SQLite.");
    }
});

// Création de la table des mesures et insertion des zones de test si absentes
db.run(`CREATE TABLE IF NOT EXISTS mesures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone TEXT,
    quartier TEXT,
    niveauEau REAL,
    statut TEXT,
    batterie INTEGER,
    signal TEXT,
    heure TEXT
)`, (err) => {
    if (!err) {
        const queryTest = `INSERT INTO mesures (zone, quartier, niveauEau, statut, batterie, signal, heure) VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const zonesSimulees = [
            ['Guédiawaye', 'Golf Sud', 5.5, 'Vigilance', 85, '22/31', '18:10:00'],
            ['Keur Massar', 'Unité 11', 8.2, 'Danger', 92, '18/31', '18:11:00'],
            ['Rufisque', 'Arafat', 1.2, 'Normal', 98, '28/31', '18:12:00'],
            ['Dakar-Plateau', 'Centre-ville', 0.0, 'Normal', 100, '31/31', '18:13:00'],
            ['yoff', 'cite biagui', 9.1, 'Danger', 92, '18/31', '18:30:00']
        ];

        // Insérer chaque zone si elle n'existe pas encore dans la base
        zonesSimulees.forEach(donnee => {
            const nomZone = donnee[0];
            db.get(`SELECT COUNT(*) as count FROM mesures WHERE zone = ?`, [nomZone], (errCheck, row) => {
                if (!errCheck && row.count === 0) {
                    db.run(queryTest, donnee, (errInsert) => {
                        if (!errInsert) {
                            console.log(`Zone de test ajoutée : ${nomZone}`);
                        }
                    });
                }
            });
        });
    }
});

// 2. Route pour recevoir les données de l'ESP (POST)
app.post('/api/donnees', (req, res) => {
    const { zone, quartier, niveauEau, statut, batterie, signal } = req.body;
    const timestamp = new Date().toLocaleTimeString();

    if (!zone) {
        return res.status(400).json({ error: "Zone requise" });
    }

    const query = `INSERT INTO mesures (zone, quartier, niveauEau, statut, batterie, signal, heure) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [zone, quartier || '', niveauEau || 0, statut || 'Normal', batterie || 100, signal || '0/31', timestamp], function(err) {
        if (err) {
            console.error("Erreur d'insertion :", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Données enregistrées en BD pour ${zone}`);
        res.status(200).json({ message: "Données enregistrées avec succès" });
    });
});

// 3. Route pour fournir les dernières données et l'historique au Frontend (GET)
app.use(express.static('public'));

app.get('/api/zones', (req, res) => {
    db.all(`SELECT * FROM mesures ORDER BY id DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        let zonesData = {};
        
        rows.forEach(row => {
            if (!zonesData[row.zone]) {
                zonesData[row.zone] = {
                    nom: row.zone,
                    quartier: row.quartier,
                    niveauEau: row.niveauEau,
                    statut: row.statut,
                    batterie: row.batterie,
                    signal: row.signal,
                    heure: row.heure,
                    historique: []
                };
            }
            if (zonesData[row.zone].historique.length < 10) {
                zonesData[row.zone].historique.push({
                    heure: row.heure,
                    niveau: row.niveauEau,
                    statut: row.statut
                });
            }
        });

        res.json(zonesData);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur actif sur le port ${PORT}`);
});