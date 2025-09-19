const API_KEY = '32a7bf250e1476db43b23491c170e02e';
const API_BASE = 'https://api.the-odds-api.com/v4';
let selectedParlayPicks = [];

class BettingPredictor {
    constructor() {
        this.historicalData = this.loadHistoricalData();
        this.currentOdds = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.fetchOdds();
        setInterval(() => this.fetchOdds(), 300000); // Refresh every 5 minutes
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.fetchOdds());
        document.getElementById('sportFilter').addEventListener('change', () => this.filterPredictions());
        document.getElementById('buildParlay').addEventListener('click', () => this.buildParlay());
        document.getElementById('wagerAmount').addEventListener('input', () => this.updateWinnings());
    }

    async fetchOdds() {
        try {
            const sport = document.getElementById('sportFilter').value;
            const regions = 'us';
            const markets = 'h2h';
            
            const response = await fetch(
                `${API_BASE}/sports/${sport}/odds?apiKey=${API_KEY}&regions=${regions}&markets=${markets}`
            );
            
            if (!response.ok) throw new Error('Failed to fetch odds');
            
            this.currentOdds = await response.json();
            this.renderPredictions();
        } catch (error) {
            console.error('Error fetching odds:', error);
            this.showError('Failed to load odds. Please try again.');
        }
    }

    predictWinner(game) {
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;
        
        // Get historical data for both teams
        const homeStats = this.getTeamStats(homeTeam);
        const awayStats = this.getTeamStats(awayTeam);
        
        // Calculate win probability based on multiple factors
        let homeProbability = this.calculateWinProbability(homeStats, awayStats);
        
        // Adjust based on current odds
        const oddsAdjustment = this.getOddsAdjustment(game.bookmakers);
        homeProbability += oddsAdjustment * 0.1;
        
        // Ensure probability is between 0 and 1
        homeProbability = Math.max(0, Math.min(1, homeProbability));
        
        return {
            winner: homeProbability > 0.5 ? homeTeam : awayTeam,
            confidence: Math.abs(homeProbability - 0.5) * 2,
            probability: homeProbability
        };
    }

    calculateWinProbability(homeStats, awayStats) {
        // Simple ELO-based calculation (you can enhance this)
        const homeElo = homeStats.elo || 1500;
        const awayElo = awayStats.elo || 1500;
        
        return 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    }

    getOddsAdjustment(bookmakers) {
        if (!bookmakers || bookmakers.length === 0) return 0;
        
        const avgOdds = bookmakers.reduce((sum, bookmaker) => {
            const market = bookmaker.markets.find(m => m.key === 'h2h');
            if (market && market.outcomes.length >= 2) {
                return sum + (market.outcomes[0].price - market.outcomes[1].price);
            }
            return sum;
        }, 0) / bookmakers.length;
        
        return avgOdds / 100;
    }

    getTeamStats(teamName) {
        // This is where you'd integrate real historical data
        // For now, using mock data
        const mockStats = {
            'Kansas City Chiefs': { elo: 1650, wins: 12, losses: 3 },
            'Buffalo Bills': { elo: 1620, wins: 11, losses: 4 },
            'Philadelphia Eagles': { elo: 1640, wins: 11, losses: 4 },
            'San Francisco 49ers': { elo: 1630, wins: 10, losses: 5 }
        };
        
        return mockStats[teamName] || { elo: 1500, wins: 8, losses: 8 };
    }

    renderPredictions() {
        const container = document.getElementById('predictions');
        const wagerAmount = parseFloat(document.getElementById('wagerAmount').value) || 100;
        
        container.innerHTML = this.currentOdds.map(game => {
            const prediction = this.predictWinner(game);
            const bestOdds = this.getBestOdds(game.bookmakers, prediction.winner);
            const potentialWin = (wagerAmount * bestOdds).toFixed(2);
            
            return `
                <div class="prediction-card" onclick="predictor.toggleParlayPick('${game.id}', '${prediction.winner}', ${bestOdds})">
                    <div class="team-info">
                        <div>
                            <h3>${game.away_team} @ ${game.home_team}</h3>
                            <p class="date">${new Date(game.commence_time).toLocaleString()}</p>
                        </div>
                        <div class="confidence-badge">
                            ${Math.round(prediction.confidence * 100)}% Confidence
                        </div>
                    </div>
                    
                    <div class="prediction-meter">
                        <p><strong>Predicted Winner:</strong> ${prediction.winner}</p>
                        <div class="meter-bar">
                            <div class="meter-fill" style="width: ${prediction.confidence * 100}%"></div>
                        </div>
                    </div>
                    
                    <div class="odds-info">
                        <p><strong>Best Odds:</strong> ${bestOdds.toFixed(2)}</p>
                        <p><strong>Potential Win:</strong> $${potentialWin}</p>
                    </div>
                    
                    <div class="bookmaker-odds">
                        ${this.renderBookmakerOdds(game.bookmakers)}
                    </div>
                </div>
            `;
        }).join('');
    }

    getBestOdds(bookmakers, predictedWinner) {
        if (!bookmakers || bookmakers.length === 0) return 1.0;
        
        let bestOdds = 1.0;
        bookmakers.forEach(bookmaker => {
            const market = bookmaker.markets.find(m => m.key === 'h2h');
            if (market) {
                const outcome = market.outcomes.find(o => o.name === predictedWinner);
                if (outcome && outcome.price > bestOdds) {
                    bestOdds = outcome.price;
                }
            }
        });
        
        return bestOdds;
    }

    renderBookmakerOdds(bookmakers) {
        if (!bookmakers || bookmakers.length === 0) return '<p>No odds available</p>';
        
        return bookmakers.slice(0, 3).map(bookmaker => {
            const market = bookmaker.markets.find(m => m.key === 'h2h');
            if (!market) return '';
            
            return `
                <div class="bookmaker">
                    <strong>${bookmaker.title}:</strong> 
                    ${market.outcomes.map(o => `${o.name}: ${o.price}`).join(' | ')}
                </div>
            `;
        }).join('');
    }

    toggleParlayPick(gameId, team, odds) {
        const pickIndex = selectedParlayPicks.findIndex(p => p.gameId === gameId);
        
        if (pickIndex > -1) {
            selectedParlayPicks.splice(pickIndex, 1);
        } else {
            selectedParlayPicks.push({ gameId, team, odds });
        }
        
        this.updateParlayDisplay();
    }

    updateParlayDisplay() {
        const container = document.getElementById('parlayPicks');
        
        if (selectedParlayPicks.length === 0) {
            container.innerHTML = '<p>Select picks to build your parlay</p>';
            return;
        }
        
        container.innerHTML = selectedParlayPicks.map(pick => `
            <div class="parlay-pick selected">
                ${pick.team} (${pick.odds})
            </div>
        `).join('');
        
        this.updateParlaySummary();
    }

    updateParlaySummary() {
        if (selectedParlayPicks.length === 0) {
            document.getElementById('parlayOdds').textContent = '-';
            document.getElementById('parlayWin').textContent = '-';
            return;
        }
        
        const totalOdds = selectedParlayPicks.reduce((acc, pick) => acc * pick.odds, 1);
        const wagerAmount = parseFloat(document.getElementById('wagerAmount').value) || 100;
        const potentialWin = (wagerAmount * totalOdds).toFixed(2);
        
        document.getElementById('parlayOdds').textContent = totalOdds.toFixed(2);
        document.getElementById('parlayWin').textContent = potentialWin;
    }

    updateWinnings() {
        this.renderPredictions();
        this.updateParlaySummary();
    }

    filterPredictions() {
        this.fetchOdds();
    }

    showError(message) {
        document.getElementById('predictions').innerHTML = `
            <div class="error">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    loadHistoricalData() {
        // Load from localStorage or initialize
        const saved = localStorage.getItem('bettingHistory');
        return saved ? JSON.parse(saved) : [];
    }

    savePrediction(game, prediction, wager, outcome) {
        const record = {
            gameId: game.id,
            date: new Date().toISOString(),
            teams: `${game.away_team} @ ${game.home_team}`,
            predictedWinner: prediction.winner,
            actualWinner: outcome?.winner,
            wager: wager,
            profit: outcome ? (outcome.won ? wager * prediction.odds - wager : -wager) : null
        };
        
        this.historicalData.push(record);
        localStorage.setItem('bettingHistory', JSON.stringify(this.historicalData));
    }
}

// Initialize the app
const predictor = new BettingPredictor();