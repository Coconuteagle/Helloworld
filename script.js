const historyEl = document.querySelector('#history');
const displayEl = document.querySelector('#display');
const keys = document.querySelector('.keys');

const operators = new Set(['+', '-', '*', '/']);
let currentInput = '0';
let expression = '';
let historyText = '';
let justCalculated = false;

function formatNumber(value) {
  if (!isFinite(value)) return 'Error';
  const text = String(Number(value.toFixed(10)));
  return text;
}

function prettifyExpression(text) {
  return text.replace(/\*/g, '×').replace(/\//g, '÷');
}

function updateScreen() {
  historyEl.textContent = historyText || prettifyExpression(expression);
  displayEl.textContent = currentInput;
}

function resetAll() {
  currentInput = '0';
  expression = '';
  historyText = '';
  justCalculated = false;
  updateScreen();
}

function appendNumber(value) {
  if (justCalculated) {
    expression = '';
    historyText = '';
    currentInput = '0';
    justCalculated = false;
  }

  if (value === '.' && currentInput.includes('.')) return;

  if (currentInput === '0' && value !== '.') {
    currentInput = value;
  } else {
    currentInput += value;
  }

  updateScreen();
}

function appendOperator(operator) {
  if (currentInput === 'Error') return resetAll();

  historyText = '';

  if (justCalculated) {
    justCalculated = false;
  }

  if (!expression) {
    expression = currentInput;
  } else if (!operators.has(expression.at(-1))) {
    expression += currentInput;
  }

  if (operators.has(expression.at(-1))) {
    expression = expression.slice(0, -1) + operator;
  } else {
    expression += operator;
  }

  currentInput = '0';
  updateScreen();
}

function applyPercent() {
  if (currentInput === 'Error') return resetAll();
  currentInput = formatNumber(Number(currentInput) / 100);
  updateScreen();
}

function deleteLast() {
  if (justCalculated) {
    return resetAll();
  }

  if (currentInput.length <= 1 || currentInput === 'Error') {
    currentInput = '0';
  } else {
    currentInput = currentInput.slice(0, -1);
  }
  updateScreen();
}

function evaluateExpression() {
  try {
    const finalExpression = expression && !operators.has(expression.at(-1))
      ? expression
      : expression + currentInput;

    if (!finalExpression) return;

    const sanitized = finalExpression.replace(/[^0-9.+\-*/() ]/g, '');
    const result = Function(`'use strict'; return (${sanitized})`)();
    historyText = `${prettifyExpression(finalExpression)} =`;
    currentInput = formatNumber(result);
    expression = '';
    justCalculated = true;
    updateScreen();
  } catch {
    currentInput = 'Error';
    expression = '';
    justCalculated = true;
    updateScreen();
  }
}

keys.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const { value, action } = button.dataset;

  if (value !== undefined) {
    if (operators.has(value)) {
      appendOperator(value);
    } else {
      appendNumber(value);
    }
    return;
  }

  if (action === 'clear') resetAll();
  if (action === 'delete') deleteLast();
  if (action === 'percent') applyPercent();
  if (action === 'equals') evaluateExpression();
});

document.addEventListener('keydown', (event) => {
  const { key } = event;

  if ((key >= '0' && key <= '9') || key === '.') {
    appendNumber(key);
    return;
  }

  if (operators.has(key)) {
    appendOperator(key);
    return;
  }

  if (key === 'Enter' || key === '=') {
    event.preventDefault();
    evaluateExpression();
  }

  if (key === 'Backspace') deleteLast();
  if (key === 'Escape') resetAll();
  if (key === '%') applyPercent();
});

updateScreen();
