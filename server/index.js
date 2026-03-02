const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});
let maxBaseId = 1000000;
let extraIds = new Set();
let selected = [];
let selectedSet = new Set();
let snapshot = {
  selected: [],
  selectedSet: new Set()
};
let version = 1;
const addQueue = new Set();
const reorderQueue = [];

setInterval(() => {
  let changed = false;

  for (const id of addQueue) {
    if (!selectedSet.has(id)) {
      selected.push(id);
      selectedSet.add(id);
      changed = true;
    }
  }

  if (changed) version++;

  addQueue.clear();
}, 10000);

setInterval(() => {
  if (reorderQueue.length) {
    const newOrder = reorderQueue.pop();
    const selectedMap = new Map();
    snapshot.selected.forEach((id, idx) => selectedMap.set(id, idx));

    const filteredOrder = [];
    const notMoved = new Set(snapshot.selected);

    for (const id of newOrder) {
      if (selectedMap.has(id)) {
        filteredOrder.push(id);
        notMoved.delete(id);
      }
    }

    filteredOrder.push(...[...notMoved].sort((a,b) => selectedMap.get(a)-selectedMap.get(b)));
    selected = filteredOrder;
    selectedSet = new Set(filteredOrder);
    reorderQueue.length = 0;
    version++;
  }
  snapshot = {
    selected: [...selected],
    selectedSet: new Set(selectedSet)
  };
}, 1000);

function matchesSearch(id, search) {
  if (!search) return true;
  return id.toString().includes(search);
}

function getUnselectedFiltered(search, offset, limit) {
  const result = [];
  let count = 0;

  const checkAndPush = (id) => {
    if (snapshot.selectedSet.has(id)) return true;
    if (!matchesSearch(id, search)) return true;
    if (count >= offset && result.length < limit) {
      result.push(id);
    }
    count++;
    return result.length < limit;
  };
  for (let i = 1; i <= maxBaseId; i++) {
    if (!checkAndPush(i)) break;
  }
  for (const id of extraIds) {
    if (!checkAndPush(id)) break;
  }
  return result;
}

function getSelectedFiltered(search, offset, limit) {
  const filtered = snapshot.selected.filter(id =>
    matchesSearch(id, search)
  );
  return filtered.slice(offset, offset + limit);
}

app.get('/api/version', (req, res) => {
  res.json({ version });
});

app.get('/api/left', (req, res) => {
  const search = req.query.search || '';
  const offset = parseInt(req.query.offset || 0);
  const items = getUnselectedFiltered(search, offset, 20);
  res.json({ items });
});

app.post('/api/add-id', (req, res) => {
  const id = Number(req.body.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Введите корректный числовой ID' });
  }

  if (
    id <= maxBaseId ||
    extraIds.has(id) ||
    selectedSet.has(id)
  ) {
    return res.status(400).json({ error: 'Элемент с данным id уже существует' });
  }

  extraIds.add(id);
  version++;
  return res.json({ success: true });
});

app.get('/api/right', (req, res) => {
  const search = req.query.search || '';
  const offset = parseInt(req.query.offset || 0);
  const items = getSelectedFiltered(search, offset, 20);
  res.json({ items });
});

app.post('/api/select', (req, res) => {
  const ids = req.body.ids || [];
  ids.forEach(id => {
    const num = Number(id);
    if (Number.isInteger(num)) {
      addQueue.add(num);
    }
  });
  res.json({ queued: ids.length });
});

app.post('/api/reorder', (req, res) => {
  reorderQueue.push(req.body.order || []);
  res.json({ queued: true });
});

app.listen(3000, () => {
  console.log('Production server running on http://localhost:3000');
});