/**
 * Retirement Scenario 1: Required Growth Rate Calculator
 * Author: dluvbell
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Dark Mode ---
    const themeToggle = document.getElementById('checkbox');
    themeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
    });

    // --- Calculator ---
    const calculateBtn = document.getElementById('calculate-btn');
    const resultContainer = document.getElementById('result-container');
    const intermediateResultEl = document.getElementById('intermediate-result');
    const resultText = document.getElementById('result-text');
    
    const tableContainer = document.getElementById('details-table-container');
    const detailsToggle = document.getElementById('details-toggle'); 
    const graphContainer = document.getElementById('graph-container');
    const graphToggle = document.getElementById('graph-toggle');
    const chartCanvas = document.getElementById('balance-chart');
    let balanceChart = null;

    // Set default dates
    const today = new Date();
    document.getElementById('current_date').valueAsDate = today;
    document.getElementById('cv_receipt_date').value = `${today.getFullYear() + 6}-01-01`;
    document.getElementById('payout_start_date').value = `${today.getFullYear() + 14}-01-01`;

    const inputIds = {
        numbers: ['cv', 'c', 'p_current_value', 'g_income', 'n_payout'],
        dates: ['current_date', 'cv_receipt_date', 'payout_start_date']
    };

    calculateBtn.addEventListener('click', () => {
        const values = {};
        for (const id of inputIds.numbers) {
            const value = parseFloat(document.getElementById(id).value);
            if (isNaN(value)) {
                alert(`Please enter a valid number in the '${id}' field.`);
                return;
            }
            values[id] = value;
        }
        for (const id of inputIds.dates) {
            const value = document.getElementById(id).value;
            if (!value) {
                alert(`Please fill in the date field '${id}'.`);
                return;
            }
            values[id] = new Date(value);
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const daysPerYear = 365.25;
        const n_growth = (values.payout_start_date - values.cv_receipt_date) / msPerDay / daysPerYear;
        const inflation_years = (values.payout_start_date - values.current_date) / msPerDay / daysPerYear;
        const g_income = values.g_income / 100;
        
        if (n_growth < 0 || inflation_years < 0) {
            alert("Please check the entered dates. They are not in chronological order.");
            return;
        }

        const p_future = values.p_current_value * Math.pow(1 + g_income, inflation_years);
        const calculationResult = calculateRequiredGrowthRate(values.cv, n_growth, values.c, p_future, values.n_payout, g_income);

        resultContainer.classList.remove('hidden');
        
        intermediateResultEl.innerHTML = `
            An annual withdrawal of <b>$${values.p_current_value.toLocaleString()}</b> as of today (${values.current_date.toLocaleDateString()}) will be worth <b>$${p_future.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b> in ${inflation_years.toFixed(2)} years on ${values.payout_start_date.toLocaleDateString()}.
        `;

        if (calculationResult !== null) {
            const { rate, startingBalance } = calculationResult;
            resultText.innerHTML = `Under the given conditions, the required <strong>average annual asset growth rate</strong> is approximately <strong>${(rate * 100).toFixed(2)}%</strong>.`;
            
            const yearlyData = getYearlySimulationData(startingBalance, values.n_payout, rate, p_future, g_income);
            
            generateDetailsTable(yearlyData);
            generateBalanceChart(yearlyData);
            
            tableContainer.style.display = detailsToggle.checked ? 'block' : 'none';
            graphContainer.style.display = graphToggle.checked ? 'block' : 'none';

        } else {
            resultText.innerHTML = "The goal is not achievable within a realistic growth rate range with the given conditions. Try adjusting the variables.";
            tableContainer.innerHTML = '';
            graphContainer.style.display = 'none';
            if (balanceChart) balanceChart.destroy();
        }
    });

    detailsToggle.addEventListener('change', () => {
        if (tableContainer.innerHTML.trim() !== '') {
            tableContainer.style.display = detailsToggle.checked ? 'block' : 'none';
        }
    });

    graphToggle.addEventListener('change', () => {
        if (balanceChart) {
            graphContainer.style.display = graphToggle.checked ? 'block' : 'none';
        }
    });

    function calculateRequiredGrowthRate(cv, n_growth, c, p, n_payout, g_income) {
        let lowRate = -0.2, highRate = 0.5, precision = 0.000001, g_asset;
        for (let i = 0; i < 100; i++) {
            g_asset = (lowRate + highRate) / 2;
            if (Math.abs(highRate - lowRate) < precision) break;
            
            const totalAssetsAtRetirement = calculateTotalAssetsAtRetirement(cv, n_growth, c, g_asset);
            const presentValueOfPayouts = calculatePresentValueOfPayouts(p, n_payout, g_income, g_asset);
            
            if (totalAssetsAtRetirement > presentValueOfPayouts) highRate = g_asset; else lowRate = g_asset;
        }

        if (g_asset >= 0.499 || g_asset <= -0.199) return null;
        const finalStartingBalance = calculateTotalAssetsAtRetirement(cv, n_growth, c, g_asset);
        return { rate: g_asset, startingBalance: finalStartingBalance };
    }
    
    function calculateTotalAssetsAtRetirement(cv, n_growth, c, g_asset) {
        const futureValueCV = cv * Math.pow(1 + g_asset, n_growth);
        const futureValueC = (Math.abs(g_asset) < 1e-9) ? c * n_growth : c * ((Math.pow(1 + g_asset, n_growth) - 1) / g_asset);
        return futureValueCV + futureValueC;
    }

    function calculatePresentValueOfPayouts(p, n_payout, g_income, g_asset) {
        if (Math.abs(g_asset - g_income) < 1e-9) return (p * n_payout) / (1 + g_income);
        const growthFactor = (1 + g_income) / (1 + g_asset);
        return (p / (g_asset - g_income)) * (1 - Math.pow(growthFactor, n_payout));
    }

    function getYearlySimulationData(startingBalance, n_payout, g_asset, p_future, g_income) {
        const data = [];
        let currentBalance = startingBalance;
        let currentWithdrawal = p_future;

        for (let year = 1; year <= n_payout; year++) {
            const growthAmount = currentBalance * g_asset;
            const endingBalance = currentBalance + growthAmount - currentWithdrawal;
            data.push({
                year,
                startingBalance: currentBalance,
                growthAmount,
                withdrawal: currentWithdrawal,
                endingBalance
            });
            currentBalance = endingBalance;
            currentWithdrawal *= (1 + g_income);
        }
        return data;
    }

    function generateDetailsTable(yearlyData) {
        tableContainer.innerHTML = ''; 
        const table = document.createElement('table');
        table.innerHTML = `<thead><tr><th>Year</th><th>Starting Balance</th><th>Asset Growth</th><th>Withdrawal</th><th>Ending Balance</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');
        
        yearlyData.forEach(data => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${data.year}</td>
                <td>$${data.startingBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${data.growthAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${data.withdrawal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${data.endingBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            `;
        });
        tableContainer.appendChild(table);
    }

    function generateBalanceChart(yearlyData) {
        if (balanceChart) {
            balanceChart.destroy(); 
        }
        
        const labels = yearlyData.map(d => d.year);
        const dataPoints = yearlyData.map(d => d.endingBalance);

        const isDarkMode = document.body.classList.contains('dark-mode');
        const textColor = isDarkMode ? '#e0e0e0' : '#333';
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        balanceChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ending Balance ($)',
                    data: dataPoints,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#007bff',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            },
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Year',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `Year: ${context[0].label}`;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += '$' + context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                                }
                                return label;
                            }
                        },
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }
    
    const observer = new MutationObserver(() => {
        if (balanceChart) {
            const isDarkMode = document.body.classList.contains('dark-mode');
            const textColor = isDarkMode ? '#e0e0e0' : '#333';
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

            balanceChart.options.scales.y.ticks.color = textColor;
            balanceChart.options.scales.y.grid.color = gridColor;
            balanceChart.options.scales.x.title.color = textColor;
            balanceChart.options.scales.x.ticks.color = textColor;
            balanceChart.options.scales.x.grid.color = gridColor;
            balanceChart.update();
        }
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
