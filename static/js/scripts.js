// Глобальные переменные
const buttons = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('section');

let gradeBook = [];
let subjectsList = [];
let chartInstances = {}; // Хранилище для графиков
let editingIndex = -1; // Индекс редактируемого ученика

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    setupFileUpload();
    setupExportButtons();
    setupStudentForm();

    // Загрузка данных из localStorage при старте
    if (loadData()) {
        renderAll();
    }
});

// Настройка навигации
function setupNavigation() {
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-section');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            if (target === 'tableStatsSection') {
                renderTableStatistics();
            } else if (target === 'graphStatsSection') {
                renderGraphStatistics();
            }
        });
    });
}

// Настройка загрузки файлов
function setupFileUpload() {
    document.getElementById('fileInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = e => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                let jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                jsonData = jsonData.filter(row => row['ФИО'] && row['Класс']);

                if (jsonData.length === 0) {
                    document.getElementById('uploadMessage').textContent = 'XLSX файл пустой или невалидный';
                    document.getElementById('uploadMessage').style.color = 'red';
                    return;
                }

                localStorage.setItem('gradeBook', JSON.stringify(jsonData));
                document.getElementById('uploadMessage').textContent = 'XLSX файл успешно загружен!';
                document.getElementById('uploadMessage').style.color = 'green';
                loadData();
                renderAll();
                displayUploadPreview();
            };
            reader.readAsArrayBuffer(file);
        } else if (ext === 'csv') {
            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target.result;
                let parsed = parseCSVorTXT(text);
                parsed = parsed.filter(row => row['ФИО'] && row['Класс']);

                if (parsed.length === 0) {
                    document.getElementById('uploadMessage').textContent = 'CSV файл пустой или невалидный';
                    document.getElementById('uploadMessage').style.color = 'red';
                    return;
                }

                localStorage.setItem('gradeBook', JSON.stringify(parsed));
                document.getElementById('uploadMessage').textContent = 'CSV файл успешно загружен!';
                document.getElementById('uploadMessage').style.color = 'green';
                loadData();
                renderAll();
                displayUploadPreview();
            };
            reader.readAsText(file, 'UTF-8');
        } else if (ext === 'txt') {
            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target.result;
                let parsed = parseCSVorTXT(text);
                parsed = parsed.filter(row => row['ФИО'] && row['Класс']);

                if (parsed.length === 0) {
                    document.getElementById('uploadMessage').textContent = 'TXT файл пустой или невалидный';
                    document.getElementById('uploadMessage').style.color = 'red';
                    return;
                }

                localStorage.setItem('gradeBook', JSON.stringify(parsed));
                document.getElementById('uploadMessage').textContent = 'TXT файл успешно загружен!';
                document.getElementById('uploadMessage').style.color = 'green';
                loadData();
                renderAll();
                displayUploadPreview();
            };
            reader.readAsText(file, 'UTF-8');
        } else {
            alert('Поддерживаются только XLSX, CSV и TXT файлы');
        }
    });
}

// Отображение предпросмотра загруженных данных
function displayUploadPreview() {
    const container = document.getElementById('uploadPreview');
    if (gradeBook.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<h3>Предпросмотр загруженных данных:</h3>';
    html += '<table><thead><tr><th>ФИО</th><th>Класс</th>';
    subjectsList.forEach(subj => html += `<th>${subj}</th>`);
    html += '</tr></thead><tbody>';

    // Показываем первые 10 записей
    const preview = gradeBook.slice(0, 10);
    preview.forEach(row => {
        html += `<tr><td>${row['ФИО'] || ''}</td><td>${row['Класс'] || ''}</td>`;
        subjectsList.forEach(subj => {
            html += `<td>${row[subj] !== undefined ? row[subj] : ''}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    if (gradeBook.length > 10) {
        html += `<p style="text-align:center; color:#666; margin-top:10px;">Показано 10 из ${gradeBook.length} записей</p>`;
    }

    container.innerHTML = html;
}

// Парсинг CSV/TXT файлов
function parseCSVorTXT(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(delimiter).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter);
        if (values.length !== headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] !== undefined ? values[idx].trim() : '';
        });
        data.push(obj);
    }
    return data;
}

// Загрузка данных из localStorage
function loadData() {
    const raw = localStorage.getItem('gradeBook');
    if (!raw) {
        gradeBook = [];
        subjectsList = [];
        return false;
    }
    try {
        gradeBook = JSON.parse(raw);
        if (!Array.isArray(gradeBook) || gradeBook.length === 0) {
            gradeBook = [];
            subjectsList = [];
            return false;
        }
        subjectsList = Object.keys(gradeBook[0]).filter(k => k !== 'ФИО' && k !== 'Класс');
        return true;
    } catch {
        gradeBook = [];
        subjectsList = [];
        return false;
    }
}

// Рендеринг всех таблиц
function renderAll() {
    renderViewTable();
    renderEditTable();
    updateGradesInputs();
}

// Рендеринг таблицы просмотра
function renderViewTable() {
    const container = document.getElementById('viewTableContainer');
    if (gradeBook.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:50px;">Данные отсутствуют. Загрузите журнал.</p>';
        return;
    }

    let html = '<table><thead><tr><th>ФИО</th><th>Класс</th>';
    subjectsList.forEach(subj => html += `<th>${subj}</th>`);
    html += '</tr></thead><tbody>';

    gradeBook.forEach(row => {
        html += `<tr><td>${row['ФИО'] || ''}</td><td>${row['Класс'] || ''}</td>`;
        subjectsList.forEach(subj => {
            html += `<td>${row[subj] !== undefined ? row[subj] : ''}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Рендеринг таблицы редактирования
function renderEditTable() {
    const container = document.getElementById('editTableContainer');
    if (gradeBook.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:50px;">Данные отсутствуют. Загрузите журнал или добавьте ученика.</p>';
        return;
    }

    let html = '<h3>Список учеников</h3>';
    html += '<table><thead><tr><th>ФИО</th><th>Класс</th>';
    subjectsList.forEach(subj => html += `<th>${subj}</th>`);
    html += '<th>Действия</th></tr></thead><tbody>';

    gradeBook.forEach((row, i) => {
        html += `<tr><td>${row['ФИО'] || ''}</td><td>${row['Класс'] || ''}</td>`;
        subjectsList.forEach(subj => {
            html += `<td>${row[subj] !== undefined ? row[subj] : ''}</td>`;
        });
        html += `<td>
            <button class="edit-user" onclick="editStudent(${i})">✏️ Редактировать</button>
            <button class="delete-user" onclick="deleteStudent(${i})">🗑️ Удалить</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Настройка формы ученика
function setupStudentForm() {
    document.getElementById('saveStudentBtn').addEventListener('click', saveStudent);
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
}

// Обновление полей для ввода оценок
function updateGradesInputs() {
    const container = document.getElementById('gradesInputs');
    if (subjectsList.length === 0) {
        container.innerHTML = '<p style="color:#999;">Загрузите файл для определения предметов</p>';
        return;
    }

    let html = '';
    subjectsList.forEach(subj => {
        html += `<div class="form-row">
            <label>${subj}:</label>
            <input type="number" id="grade_${subj}" min="1" max="5" step="1" placeholder="Оценка (1-5)">
        </div>`;
    });

    container.innerHTML = html;
}

// Редактирование ученика
function editStudent(index) {
    editingIndex = index;
    const student = gradeBook[index];

    document.getElementById('studentName').value = student['ФИО'] || '';
    document.getElementById('studentClass').value = student['Класс'] || '';

    subjectsList.forEach(subj => {
        const input = document.getElementById(`grade_${subj}`);
        if (input) {
            input.value = student[subj] || '';
        }
    });

    // Прокрутка к форме
    document.querySelector('.edit-form').scrollIntoView({ behavior: 'smooth' });
}

// Сохранение ученика
function saveStudent() {
    const name = document.getElementById('studentName').value.trim();
    const className = document.getElementById('studentClass').value.trim();

    if (!name || !className) {
        alert('Заполните ФИО и класс ученика');
        return;
    }

    const student = {
        'ФИО': name,
        'Класс': className
    };

    // Сохраняем оценки
    let hasError = false;
    subjectsList.forEach(subj => {
        const input = document.getElementById(`grade_${subj}`);
        if (input) {
            const value = input.value.trim();
            if (value !== '') {
                const num = parseFloat(value);
                if (isNaN(num) || num < 1 || num > 5) {
                    alert(`Оценка по предмету "${subj}" должна быть числом от 1 до 5`);
                    hasError = true;
                    return;
                }
                student[subj] = num;
            } else {
                student[subj] = '';
            }
        }
    });

    if (hasError) return;

    if (editingIndex >= 0) {
        // Редактирование существующего
        gradeBook[editingIndex] = student;
        editingIndex = -1;
    } else {
        // Добавление нового
        gradeBook.push(student);
    }

    localStorage.setItem('gradeBook', JSON.stringify(gradeBook));
    loadData();
    renderAll();
    clearForm();

    alert('Ученик успешно сохранен!');
}

// Отмена редактирования
function cancelEdit() {
    editingIndex = -1;
    clearForm();
}

// Очистка формы
function clearForm() {
    document.getElementById('studentName').value = '';
    document.getElementById('studentClass').value = '';

    subjectsList.forEach(subj => {
        const input = document.getElementById(`grade_${subj}`);
        if (input) {
            input.value = '';
        }
    });
}

// Удаление ученика
function deleteStudent(index) {
    if (!confirm(`Удалить ученика "${gradeBook[index]['ФИО']}"?`)) return;

    gradeBook.splice(index, 1);
    localStorage.setItem('gradeBook', JSON.stringify(gradeBook));
    loadData();
    renderAll();
}

// Настройка кнопок экспорта
function setupExportButtons() {
    document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
    document.getElementById('exportTXTBtn').addEventListener('click', exportTXT);
    document.getElementById('exportXLSXBtn').addEventListener('click', exportXLSX);
}

// Экспорт в CSV
function exportCSV() {
    if (gradeBook.length === 0) {
        alert('Нет данных для экспорта!');
        return;
    }

    let csv = 'ФИО,Класс,' + subjectsList.join(',') + '\n';
    gradeBook.forEach(row => {
        let line = `"${row['ФИО']}","${row['Класс']}"`;
        subjectsList.forEach(subj => {
            line += `,${row[subj] || ''}`;
        });
        csv += line + '\n';
    });

    downloadFile(csv, 'journal.csv', 'text/csv;charset=utf-8');
}

// Экспорт в TXT
function exportTXT() {
    if (gradeBook.length === 0) {
        alert('Нет данных для экспорта!');
        return;
    }

    let lines = [];
    const headers = ['ФИО', 'Класс', ...subjectsList];
    lines.push(headers.join('\t'));

    gradeBook.forEach(row => {
        const line = headers.map(h => row[h] || '').join('\t');
        lines.push(line);
    });

    const txt = lines.join('\n');
    downloadFile(txt, 'journal.txt', 'text/plain;charset=utf-8');
}

// Экспорт в XLSX
function exportXLSX() {
    if (gradeBook.length === 0) {
        alert('Нет данных для экспорта!');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(gradeBook);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Журнал");
    XLSX.writeFile(wb, 'journal.xlsx');
}

// Скачивание файла
function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

// Вычисление медианы
function median(arr) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
}

// Рендеринг табличной статистики
function renderTableStatistics() {
    const container = document.getElementById('tableStatsContainer');
    const noData = document.getElementById('noTableData');

    if (!loadData() || gradeBook.length === 0) {
        container.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';

    const classes = Array.from(new Set(gradeBook.map(r => r['Класс']))).sort((a, b) => {
        const parseClass = c => {
            const m = c.match(/^(\d+)([А-Яа-яA-Za-z]*)$/);
            if (!m) return [1000, c];
            return [parseInt(m[1], 10), m[2].toUpperCase()];
        };
        const [numA, letA] = parseClass(a);
        const [numB, letB] = parseClass(b);
        if (numA !== numB) return numA - numB;
        return letA.localeCompare(letB);
    });

    let html = '<div class="stats-section">';

    // Статистика по каждому классу и предмету
    html += '<h3>Статистика по классам и предметам</h3>';

    subjectsList.forEach(subj => {
        html += `<table class="stats-table">
            <caption>Предмет: ${subj}</caption>
            <thead><tr>
                <th>Класс</th>
                <th>Средняя оценка</th>
                <th>Медиана</th>
                <th>Кол-во "5"</th>
                <th>Кол-во "4"</th>
                <th>Кол-во "3"</th>
                <th>Кол-во "2"</th>
                <th>Кол-во "1"</th>
                <th>% "5"</th>
                <th>% "4"</th>
                <th>% "3"</th>
                <th>% "2"</th>
                <th>% "1"</th>
            </tr></thead><tbody>`;

        classes.forEach(cls => {
            const studentsInClass = gradeBook.filter(r => r['Класс'] === cls);
            const vals = studentsInClass.map(r => parseFloat(r[subj])).filter(v => !isNaN(v));

            if (vals.length === 0) return;

            const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
            const med = median(vals).toFixed(2);

            const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            vals.forEach(v => counts[v]++);

            const total = vals.length;
            const percents = {};
            [1, 2, 3, 4, 5].forEach(g => percents[g] = ((counts[g] / total) * 100).toFixed(1));

            html += `<tr>
                <td>${cls}</td>
                <td>${avg}</td>
                <td>${med}</td>
                <td>${counts[5]}</td>
                <td>${counts[4]}</td>
                <td>${counts[3]}</td>
                <td>${counts[2]}</td>
                <td>${counts[1]}</td>
                <td>${percents[5]}%</td>
                <td>${percents[4]}%</td>
                <td>${percents[3]}%</td>
                <td>${percents[2]}%</td>
                <td>${percents[1]}%</td>
            </tr>`;
        });

        html += '</tbody></table>';
    });

    // Общая статистика по всем классам
    html += '<h3 style="margin-top: 40px;">Общая статистика по всем классам</h3>';
    html += `<table class="stats-table">
        <caption>Статистика по предметам (все классы)</caption>
        <thead><tr>
            <th>Предмет</th>
            <th>Средняя оценка</th>
            <th>Медиана</th>
            <th>Кол-во "5"</th>
            <th>Кол-во "4"</th>
            <th>Кол-во "3"</th>
            <th>Кол-во "2"</th>
            <th>Кол-во "1"</th>
            <th>% "5"</th>
            <th>% "4"</th>
            <th>% "3"</th>
            <th>% "2"</th>
            <th>% "1"</th>
        </tr></thead><tbody>`;

    subjectsList.forEach(subj => {
        const allVals = gradeBook.map(r => parseFloat(r[subj])).filter(v => !isNaN(v));

        if (allVals.length === 0) return;

        const avg = (allVals.reduce((a, b) => a + b, 0) / allVals.length).toFixed(2);
        const med = median(allVals).toFixed(2);

        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allVals.forEach(v => counts[v]++);

        const total = allVals.length;
        const percents = {};
        [1, 2, 3, 4, 5].forEach(g => percents[g] = ((counts[g] / total) * 100).toFixed(1));

        html += `<tr>
            <td>${subj}</td>
            <td>${avg}</td>
            <td>${med}</td>
            <td>${counts[5]}</td>
            <td>${counts[4]}</td>
            <td>${counts[3]}</td>
            <td>${counts[2]}</td>
            <td>${counts[1]}</td>
            <td>${percents[5]}%</td>
            <td>${percents[4]}%</td>
            <td>${percents[3]}%</td>
            <td>${percents[2]}%</td>
            <td>${percents[1]}%</td>
        </tr>`;
    });

    html += '</tbody></table></div>';

    container.innerHTML = html;
}

// Рендеринг графической статистики
function renderGraphStatistics() {
    const chartContainer = document.getElementById('chartContainer');
    const noData = document.getElementById('noGraphData');

    chartContainer.innerHTML = '';

    if (!loadData() || gradeBook.length === 0) {
        chartContainer.style.display = 'none';
        noData.style.display = 'block';
        return;
    }

    chartContainer.style.display = 'block';
    noData.style.display = 'none';

    const classes = Array.from(new Set(gradeBook.map(r => r['Класс']))).sort((a, b) => {
        const parseClass = c => {
            const m = c.match(/^(\d+)([А-Яа-яA-Za-z]*)$/);
            if (!m) return [1000, c];
            return [parseInt(m[1], 10), m[2].toUpperCase()];
        };
        const [numA, letA] = parseClass(a);
        const [numB, letB] = parseClass(b);
        if (numA !== numB) return numA - numB;
        return letA.localeCompare(letB);
    });

    subjectsList.forEach(subj => {
        // Создаем canvas для графика
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${subj}`;
        canvas.style.marginBottom = '30px';
        chartContainer.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const data = classes.map(cls => {
            const studentsInClass = gradeBook.filter(r => r['Класс'] === cls);
            const vals = studentsInClass.map(r => parseFloat(r[subj])).filter(v => !isNaN(v));
            if (vals.length === 0) return 0;
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return +avg.toFixed(2);
        });

        // Удаляем старый график если существует
        if (chartInstances[subj]) {
            chartInstances[subj].destroy();
        }

        // Создаем новый график
        chartInstances[subj] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: classes,
                datasets: [{
                    label: `Средний балл по предмету: ${subj}`,
                    data: data,
                    backgroundColor: 'rgba(118,75,162,0.7)',
                    borderColor: '#764ba2',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `Средний балл по классам для предмета "${subj}"`,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        title: { display: true, text: 'Средний балл' }
                    },
                    x: {
                        title: { display: true, text: 'Классы' }
                    }
                }
            }
        });
    });
}