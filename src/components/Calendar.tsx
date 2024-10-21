import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  useMediaQuery,
  useTheme,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import saveAs from 'file-saver';
import io from 'socket.io-client';

interface Event {
  title: string;
  start: string;
  end?: string;
  category?: string;
  description?: string;
  reminderTime?: string;
  sharedWith?: string[]; // New property to hold list of shared users
}

const socket = io('http://localhost:5000'); // Change to your backend URL

const Calendar: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [localTime, setLocalTime] = useState<string>(new Date().toLocaleTimeString());
  const [holidays, setHolidays] = useState<Event[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [themeColor, setThemeColor] = useState<string>('light');
  const [open, setOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDescription, setEventDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('30');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [sharedUsers, setSharedUsers] = useState<string[]>([]); // For managing shared users
  const [newUser, setNewUser] = useState<string>(''); // New user to share event with
  const calendarRef = React.useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchHolidays = async () => {
      const COUNTRY_CODE = 'ID';
      try {
        const response = await axios.get(`https://date.nager.at/Api/v2/PublicHoliday/${year}/${COUNTRY_CODE}`);
        const holidaysData = response.data.map((holiday: any) => ({
          title: holiday.localName,
          start: holiday.date,
          end: holiday.date,
        }));
        setHolidays(holidaysData);
      } catch (error) {
        console.error('Error fetching holidays:', error);
      }
    };
    fetchHolidays();
  }, [year]);

  useEffect(() => {
    setAllEvents([...events, ...holidays]);
  }, [events, holidays]);

  useEffect(() => {
    socket.on('newEvent', (newEvent: Event) => {
      setEvents((prevEvents) => [...prevEvents, newEvent]);
    });

    socket.on('sharedEvent', (sharedEvent: Event) => {
      toast.info(`Acara dibagikan dengan Anda: ${sharedEvent.title}`);
      setEvents((prevEvents) => [...prevEvents, sharedEvent]);
    });

    return () => {
      socket.off('newEvent');
      socket.off('sharedEvent');
    };
  }, []);

  const validateDate = (dateString: string) => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  const handleClickOpen = (date: string, event?: Event) => {
    if (event) {
      setSelectedEvent(event);
      setEventTitle(event.title);
      setSelectedDate(event.start);
      setEventDescription(event.description || '');
      setCategory(event.category || '');
      setReminderTime(event.reminderTime || '30');
      setSharedUsers(event.sharedWith || []);
    } else {
      setSelectedDate(date);
      setEventTitle('');
      setSelectedEvent(null);
      setEventDescription('');
      setCategory('');
      setReminderTime('30');
      setSharedUsers([]);
    }
    setOpen(true);
  };

  const handleAddEvent = () => {
    if (eventTitle && validateDate(selectedDate)) {
      let newEvent: Event = {
        title: eventTitle,
        start: selectedDate,
        description: eventDescription,
        category: category,
        reminderTime: reminderTime,
        sharedWith: sharedUsers,
      };
      if (selectedEvent) {
        newEvent = { ...selectedEvent, title: eventTitle, description: eventDescription, category: category, reminderTime: reminderTime, sharedWith: sharedUsers };
        setEvents((prevEvents) =>
          prevEvents.map((event) => (event.start === selectedEvent.start ? newEvent : event))
        );
      } else {
        setEvents((prevEvents) => [...prevEvents, newEvent]);
        socket.emit('createEvent', newEvent); // Send new event to server
      }
      addReminder(newEvent);
      setOpen(false);
    } else {
      toast.error("Please enter a valid event title and date!");
    }
  };

  const handleDeleteEvent = () => {
    if (selectedEvent) {
      setEvents((prevEvents) => prevEvents.filter((event) => event.start !== selectedEvent.start));
      handleClose();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEventTitle('');
    setSelectedEvent(null);
    setSharedUsers([]);
  };

  const addReminder = (event: Event) => {
    const reminderMinutes = parseInt(event.reminderTime || '30', 10);
    const reminderTime = new Date(event.start).getTime() - reminderMinutes * 60 * 1000;
    const currentTime = new Date().getTime();
    if (reminderTime > currentTime) {
      setTimeout(() => {
        toast(`Pengingat: ${event.title} akan dimulai!`);
      }, reminderTime - currentTime);
    }
  };

  const handleSearch = () => {
    const filteredEvents = allEvents.filter((event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setEvents(filteredEvents);
  };

  const handleExport = () => {
    const icsContent = allEvents
      .map(
        (event) =>
          `BEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${new Date(event.start).toISOString().replace(/-|:|\.\d+/g, '')}\nEND:VEVENT`
      )
      .join('\n');
    const blob = new Blob([`BEGIN:VCALENDAR\n${icsContent}\nEND:VCALENDAR`], { type: 'text/calendar;charset=utf-8' });
    saveAs(blob, 'events.ics');
  };

  const handleShareEvent = () => {
    if (selectedEvent && newUser) {
      const updatedEvent = { ...selectedEvent, sharedWith: [...(selectedEvent.sharedWith || []), newUser] };
      setEvents((prevEvents) =>
        prevEvents.map((event) => (event.start === selectedEvent.start ? updatedEvent : event))
      );
      socket.emit('shareEvent', updatedEvent, newUser); // Send the shared event to the server
      setNewUser('');
      toast.success('Acara berhasil dibagikan!');
    }
  };

  return (
    <div className={`bg-${themeColor} shadow-lg rounded-lg p-6`}>
      <div className="time-display text-xl font-bold mb-4">Waktu Lokal: {localTime}</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <TextField
          label="Cari Acara"
          variant="outlined"
          fullWidth
          margin="normal"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Button variant="contained" color="primary" onClick={handleSearch} style={{ height: '56px' }}>
          Cari
        </Button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Button variant="contained" color="primary" onClick={handleExport}>
          Export Acara
        </Button>
        <TextField
          label="Tahun"
          variant="outlined"
          type="number"
          value={year}
          onChange={(e) => {
            const newYear = parseInt(e.target.value);
            if (!isNaN(newYear) && newYear >= 1) {
              setYear(newYear);
              if (calendarRef.current) {
                calendarRef.current.getApi().gotoDate(new Date(`${newYear}-01-01`));
              }
            }
          }}
          style={{ minWidth: '120px' }}
        />
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? 'timeGridDay' : 'dayGridMonth'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: isMobile ? 'timeGridDay' : 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{
          today: 'Hari Ini',
          month: 'Bulan',
          week: 'Minggu',
          day: 'Hari',
        }}
        editable={true}
        selectable={true}
        dayMaxEvents={true}
        events={events} // Display the filtered or all events
        eventColor="#4A90E2"
        eventTextColor="#ffffff"
        dayHeaderClassNames="text-lg font-semibold text-gray-800"
        dayCellClassNames="border border-gray-300 hover:bg-gray-200 transition duration-200"
        eventClassNames="rounded-lg px-2 py-1"
        dateClick={(info) => handleClickOpen(info.dateStr)}
        eventClick={(info) => handleClickOpen(info.event.startStr, { title: info.event.title, start: info.event.startStr })}

        ref={calendarRef} // Reference to the calendar instance
      />

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{selectedEvent ? 'Edit Acara' : 'Tambah Acara'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Judul Acara"
            type="text"
            fullWidth
            variant="outlined"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Deskripsi"
            type="text"
            fullWidth
            variant="outlined"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
          />
          <FormControl variant="outlined" fullWidth margin="normal">
            <InputLabel id="category-label">Kategori</InputLabel>
            <Select
              labelId="category-label"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              label="Kategori"
            >
              <MenuItem value="Meeting">Meeting</MenuItem>
              <MenuItem value="Reminder">Reminder</MenuItem>
              <MenuItem value="Holiday">Holiday</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Waktu Pengingat (Menit)"
            type="number"
            fullWidth
            variant="outlined"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Bagikan Acara dengan Pengguna"
            type="text"
            fullWidth
            variant="outlined"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
          />
          <Button onClick={handleShareEvent} color="primary">
            Bagikan
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteEvent} color="secondary" disabled={!selectedEvent}>
            Hapus
          </Button>
          <Button onClick={handleAddEvent} color="primary">
            {selectedEvent ? 'Simpan' : 'Tambah'}
          </Button>
          <Button onClick={handleClose} color="secondary">
            Tutup
          </Button>
        </DialogActions>
      </Dialog>

      <ToastContainer />
    </div>
  );
};

export default Calendar;