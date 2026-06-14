const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== ДАННЫЕ =====

let bookings = [];
let subscribers = [];

// Все категории номеров (9 штук)
const roomTypes = [
    { name: 'Гранд Супериор', price: 15900, capacity: 2, area: '40 кв.м', image: 'img/room/1_1.png' },
    { name: 'Авторский Делюкс', price: 20800, capacity: 3, area: '55 кв.м', image: 'img/room/2_1.png' },
    { name: 'Исторический Люкс', price: 26700, capacity: 4, area: '60 кв.м', image: 'img/room/3_1.png' },
    { name: 'Люкс Метрополь', price: 30000, capacity: 4, area: '80 кв.м', image: 'img/room/4_1.png' },
    { name: 'Премьер Люкс', price: 33000, capacity: 4, area: '95 кв.м', image: 'img/room/5_1.png' },
    { name: 'Представительский', price: 38000, capacity: 3, area: '35 кв.м', image: 'img/room/1_2.png' },
    { name: 'Авторский Представительский', price: 42000, capacity: 2, area: '35 кв.м', image: 'img/room/2_2.png' },
    { name: 'Посольский Люкс', price: 60000, capacity: 4, area: '130 кв.м', image: 'img/room/6_5.png' },
    { name: 'Люкс Большой', price: 64000, capacity: 4, area: '60 кв.м', image: 'img/room/3_2.png' }
];

// Генерация 78 номеров
function generateRooms() {
    const rooms = [];
    let id = 1;
    
    for (let typeIndex = 0; typeIndex < roomTypes.length; typeIndex++) {
        const type = roomTypes[typeIndex];
        let count = typeIndex < 5 ? 9 : 8;
        if (typeIndex === 8) count = 9;
        
        for (let i = 1; i <= count; i++) {
            const floor = Math.floor(id / 6) + 1;
            rooms.push({
                id: id++,
                number: `${typeIndex + 1}${i.toString().padStart(2, '0')}`,
                type: type.name,
                price: type.price,
                area: type.area,
                capacity: type.capacity,
                floor: floor > 13 ? 13 : floor,
                status: 'available',
                bed: 'King Size'
            });
        }
    }
    
    while (rooms.length < 78) {
        rooms.push({
            id: id++,
            number: `9${rooms.length + 1}`,
            type: 'Люкс Большой',
            price: 64000,
            area: '60 кв.м',
            capacity: 4,
            floor: 9,
            status: 'available',
            bed: 'King Size'
        });
    }
    return rooms;
}

let rooms = generateRooms();
let roomBookings = [];

// Обновление статусов номеров
function updateAllRoomsStatus() {
    const today = new Date().toISOString().split('T')[0];
    
    rooms.forEach(room => {
        if (room.status !== 'maintenance') {
            room.status = 'available';
        }
    });
    
    roomBookings.forEach(booking => {
        const room = rooms.find(r => r.id === booking.room_id);
        if (room && room.status !== 'maintenance') {
            if (booking.check_in <= today && booking.check_out > today) {
                room.status = 'booked';
            }
        }
    });
    
    bookings.forEach(booking => {
        if (booking.status === 'confirmed' && booking.room_number) {
            const room = rooms.find(r => r.number === booking.room_number);
            if (room && room.status !== 'maintenance') {
                if (booking.check_in <= today && booking.check_out > today) {
                    room.status = 'booked';
                }
            }
        }
    });
}

// ===== API =====

app.get('/api/rooms', (req, res) => {
    updateAllRoomsStatus();
    res.json(rooms);
});

app.get('/api/rooms/stats', (req, res) => {
    updateAllRoomsStatus();
    const available = rooms.filter(r => r.status === 'available').length;
    const booked = rooms.filter(r => r.status === 'booked').length;
    const maintenance = rooms.filter(r => r.status === 'maintenance').length;
    res.json({ total: rooms.length, available, booked, maintenance });
});

app.put('/api/rooms/:id/status', (req, res) => {
    const room = rooms.find(r => r.id == req.params.id);
    if (room) {
        room.status = req.body.status;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

app.post('/api/rooms/update-status', (req, res) => {
    updateAllRoomsStatus();
    res.json({ success: true });
});

app.get('/api/rooms/:id/bookings', (req, res) => {
    const bookingsList = roomBookings.filter(b => b.room_id == req.params.id);
    res.json(bookingsList);
});

app.post('/api/rooms/bookings', (req, res) => {
    const { room_id, check_in, check_out, guest_name } = req.body;
    const newBooking = {
        id: Date.now(),
        room_id: parseInt(room_id),
        check_in,
        check_out,
        guest_name
    };
    roomBookings.push(newBooking);
    updateAllRoomsStatus();
    res.json({ success: true, booking: newBooking });
});

app.get('/api/bookings', (req, res) => {
    res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
    const { full_name, email, phone, room_type, check_in, check_out, adults, children, total_price } = req.body;
    
    const roomTypeData = roomTypes.find(t => t.name === room_type);
    if (!roomTypeData) {
        return res.status(400).json({ success: false, message: 'Категория не найдена' });
    }
    
    const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
    if (totalGuests > roomTypeData.capacity) {
        return res.status(400).json({ 
            success: false, 
            message: `Номер "${room_type}" вмещает максимум ${roomTypeData.capacity} гостей. Вы указали ${totalGuests} (${adults} взрослых + ${children} детей)`
        });
    }
    
    updateAllRoomsStatus();
    const availableRoom = rooms.find(r => r.type === room_type && r.status === 'available');
    let roomNumber = null;
    let roomId = null;
    
    if (availableRoom) {
        roomNumber = availableRoom.number;
        roomId = availableRoom.id;
        roomBookings.push({
            id: Date.now(),
            room_id: roomId,
            check_in: check_in,
            check_out: check_out,
            guest_name: full_name
        });
        updateAllRoomsStatus();
    }
    
    const booking = {
        id: Date.now(),
        booking_number: 'AMAN' + Date.now(),
        full_name,
        email,
        phone,
        room_type,
        room_number: roomNumber,
        check_in,
        check_out,
        adults: parseInt(adults) || 2,
        children: parseInt(children) || 0,
        total_price: parseFloat(total_price),
        status: 'pending',
        created_at: new Date().toISOString()
    };
    
    bookings.push(booking);
    console.log('✅ Новое бронирование:', booking.full_name, 'Номер:', roomNumber || 'не назначен');
    
    res.json({ 
        success: true, 
        booking_number: booking.booking_number,
        message: roomNumber ? 'Бронирование создано! Номер ' + roomNumber + ' зарезервирован.' : 'Бронирование создано, ожидайте подтверждения.'
    });
});

app.put('/api/bookings/:id/status', (req, res) => {
    const booking = bookings.find(b => b.id == req.params.id);
    if (booking) {
        booking.status = req.body.status;
        updateAllRoomsStatus();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// ===== ОБНОВЛЕНИЕ ДАТ БРОНИРОВАНИЯ =====
app.put('/api/bookings/:id/dates', (req, res) => {
    const id = parseInt(req.params.id);
    const { check_in, check_out } = req.body;
    const booking = bookings.find(b => b.id === id);
    
    if (!booking) {
        return res.status(404).json({ error: 'Бронирование не найдено' });
    }
    
    // Обновляем даты
    booking.check_in = check_in;
    booking.check_out = check_out;
    
    // Пересчитываем стоимость
    const roomTypeData = roomTypes.find(t => t.name === booking.room_type);
    if (roomTypeData) {
        const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
        booking.total_price = roomTypeData.price * nights;
    }
    
    // Обновляем даты в roomBookings
    const roomBooking = roomBookings.find(rb => rb.guest_name === booking.full_name && rb.check_in === booking.check_in);
    if (roomBooking) {
        roomBooking.check_in = check_in;
        roomBooking.check_out = check_out;
    }
    
    updateAllRoomsStatus();
    res.json({ success: true, booking });
});

app.delete('/api/bookings/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const booking = bookings.find(b => b.id === id);
    
    if (booking && booking.room_number) {
        const roomBookingIndex = roomBookings.findIndex(rb => rb.guest_name === booking.full_name && rb.check_in === booking.check_in);
        if (roomBookingIndex !== -1) {
            roomBookings.splice(roomBookingIndex, 1);
        }
    }
    
    bookings = bookings.filter(b => b.id !== id);
    updateAllRoomsStatus();
    res.json({ success: true });
});

app.get('/api/subscribers', (req, res) => {
    res.json(subscribers);
});

app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false });
    if (!subscribers.find(s => s.email === email)) {
        subscribers.push({ id: Date.now(), email, created_at: new Date().toISOString() });
    }
    res.json({ success: true });
});

app.delete('/api/subscribers/:id', (req, res) => {
    subscribers = subscribers.filter(s => s.id != req.params.id);
    res.json({ success: true });
});

app.post('/api/contact', (req, res) => {
    console.log('📧 Сообщение от:', req.body.name);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    if (req.body.username === 'admin' && req.body.password === 'admin123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'API работает!' });
});

// ===== СТРАНИЦЫ =====

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/rooms', (req, res) => res.sendFile(__dirname + '/public/rooms.html'));
app.get('/about-us', (req, res) => res.sendFile(__dirname + '/public/about-us.html'));
app.get('/blog', (req, res) => res.sendFile(__dirname + '/public/blog.html'));
app.get('/blog-details', (req, res) => res.sendFile(__dirname + '/public/blog-details.html'));
app.get('/contact', (req, res) => res.sendFile(__dirname + '/public/contact.html'));
app.get('/room-details', (req, res) => res.sendFile(__dirname + '/public/room-details.html'));

// ===== ТЕСТОВЫЕ ДАННЫЕ =====

function addTestData() {
    if (bookings.length === 0) {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + 5);
        const futureDateEnd = new Date(today);
        futureDateEnd.setDate(today.getDate() + 10);
        
        bookings.push({
            id: 1,
            booking_number: 'AMAN1704123001',
            full_name: 'Иванов Иван',
            email: 'ivan@test.ru',
            phone: '+7 (999) 123-45-67',
            room_type: 'Гранд Супериор',
            room_number: '101',
            check_in: futureDate.toISOString().split('T')[0],
            check_out: futureDateEnd.toISOString().split('T')[0],
            adults: 2,
            children: 0,
            total_price: 79500,
            status: 'confirmed',
            created_at: new Date().toISOString()
        });
        
        roomBookings.push({
            id: 101,
            room_id: 1,
            check_in: futureDate.toISOString().split('T')[0],
            check_out: futureDateEnd.toISOString().split('T')[0],
            guest_name: 'Иванов Иван'
        });
    }
    
    if (subscribers.length === 0) {
        subscribers.push({ id: 1, email: 'test@example.com', created_at: new Date().toISOString() });
    }
    
    updateAllRoomsStatus();
}

addTestData();

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   ✅ AMAN HOTEL - СЕРВЕР ЗАПУЩЕН');
    console.log('========================================');
    console.log(`   🌐 Сайт: http://localhost:${PORT}`);
    console.log(`   👑 Админка: http://localhost:${PORT}/admin`);
    console.log(`   🔑 Логин: admin / admin123`);
    console.log(`   🛌 Номеров: ${rooms.length}`);
    console.log(`   📊 Категорий: ${roomTypes.length}`);
    console.log('========================================\n');
});