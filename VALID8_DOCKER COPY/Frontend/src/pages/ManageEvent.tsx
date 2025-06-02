import { useState, useEffect } from "react";
import { NavbarEventOrganizer } from "../components/NavbarEventOrganizer";
import { NavbarStudentSSGEventOrganizer } from "../components/NavbarStudentSSGEventOrganizer";
import Modal from "react-modal";
import { useNavigate } from "react-router-dom";

interface ManageEventProps {
  role: string;
}

interface Department {
  id: number;
  name: string;
}

interface Program {
  id: number;
  name: string;
  department_ids: number[];
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface SSGMember {
  user_id: number;
  position: string;
  user: User;
}

interface Event {
  id: number;
  name: string;
  start_datetime: string;
  end_datetime: string;
  location: string;
  status: string;
  departments: Department[];
  programs: Program[];
  ssg_members: SSGMember[];
  department_ids?: number[];
  program_ids?: number[];
  ssg_member_ids?: number[];
}

export const ManageEvent: React.FC<ManageEventProps> = ({ role }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [ssgMembers, setSSGMembers] = useState<SSGMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isStatusModalOpen, setStatusModalOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<string | null>(null);
  const [eventToUpdate, setEventToUpdate] = useState<number | null>(null);

  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      throw new Error("No authentication token found");
    }

    const isFormData = options.body instanceof FormData;
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      ...(!isFormData && { "Content-Type": "application/json" }),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        localStorage.removeItem("authToken");
        navigate("/login");
        throw new Error("Session expired. Please login again.");
      }
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error("API Error (non-JSON):", errorText);
        }
        throw new Error(
          errorData?.detail || `HTTP error! status: ${response.status}`
        );
      }
      return response;
    } catch (err) {
      console.error(`Error fetching ${url}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const eventsResponse = await fetchWithAuth(`${BASE_URL}/events`);
        const eventsData = await eventsResponse.json();
        const transformedEvents = (
          Array.isArray(eventsData) ? eventsData : []
        ).map((event: Event) => ({
          ...event,
          department_ids: Array.isArray(event.departments)
            ? event.departments.map((d: Department) => d.id)
            : [],
          program_ids: Array.isArray(event.programs)
            ? event.programs.map((p: Program) => p.id)
            : [],
          ssg_member_ids: Array.isArray(event.ssg_members)
            ? event.ssg_members.map((m: SSGMember) => m.user_id)
            : [],
        }));
        setEvents(transformedEvents);

        const deptResponse = await fetchWithAuth(`${BASE_URL}/departments`);
        const deptData = await deptResponse.json();
        setDepartments(deptData);

        const programsResponse = await fetchWithAuth(`${BASE_URL}/programs`);
        const programsData = await programsResponse.json();
        setPrograms(programsData);

        const ssgResponse = await fetchWithAuth(
          `${BASE_URL}/users/by-role/ssg`
        );
        const ssgData = await ssgResponse.json();
        const transformedMembers = Array.isArray(ssgData)
          ? ssgData.map((user: any) => ({
              user_id: user.id,
              position: user.ssg_profile?.position || "Member",
              user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
              },
            }))
          : [];
        setSSGMembers(transformedMembers);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [BASE_URL, navigate]);

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEditModal = (item: Event) => {
    setEditingEvent({
      ...item,
      department_ids: item.departments?.map((d) => d.id) || [],
      program_ids: item.programs?.map((p) => p.id) || [],
      ssg_member_ids: item.ssg_members?.map((m) => m.user_id) || [],
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingEvent(null);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (editingEvent) {
      setEditingEvent({ ...editingEvent, [e.target.name]: e.target.value });
    }
  };

  const saveEditedEvent = async () => {
    if (!editingEvent) return;
    try {
      const updatePayload = {
        name: editingEvent.name,
        location: editingEvent.location,
        start_datetime: editingEvent.start_datetime,
        end_datetime: editingEvent.end_datetime,
        department_ids: editingEvent.department_ids || [],
        program_ids: editingEvent.program_ids || [],
        ssg_member_ids: editingEvent.ssg_member_ids || [],
      };

      const response = await fetchWithAuth(
        `${BASE_URL}/events/${editingEvent.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        }
      );

      const updatedEvent = await response.json();
      const transformedEvent = {
        ...updatedEvent,
        department_ids:
          updatedEvent.departments?.map((d: Department) => d.id) || [],
        program_ids: updatedEvent.programs?.map((p: Program) => p.id) || [],
        ssg_member_ids:
          updatedEvent.ssg_members?.map((m: SSGMember) => m.user_id) || [],
      };

      setEvents(
        events.map((event) =>
          event.id === transformedEvent.id ? transformedEvent : event
        )
      );
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    }
  };

  const updateEventStatus = async () => {
    if (!eventToUpdate || !statusToUpdate) return;
    try {
      await fetchWithAuth(
        `${BASE_URL}/events/${eventToUpdate}/status?status=${statusToUpdate.toLowerCase()}`,
        { method: "PATCH" }
      );
      setEvents(
        events.map((event) =>
          event.id === eventToUpdate
            ? { ...event, status: statusToUpdate }
            : event
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusModalOpen(false);
      setEventToUpdate(null);
      setStatusToUpdate(null);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await fetchWithAuth(`${BASE_URL}/events/${itemToDelete}`, {
        method: "DELETE",
      });
      setEvents(events.filter((event) => event.id !== itemToDelete));
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const getStatusBadge = (status: string) => {
    const badgeStyles: Record<string, React.CSSProperties> = {
      upcoming: { backgroundColor: "#0d6efd", color: "white" },
      ongoing: { backgroundColor: "#ffc107", color: "black" },
      completed: { backgroundColor: "#198754", color: "white" },
      cancelled: { backgroundColor: "#dc3545", color: "white" },
      default: { backgroundColor: "#6c757d", color: "white" },
    };

    const style = badgeStyles[status.toLowerCase()] || badgeStyles.default;
    return (
      <span
        style={{
          padding: "0.25rem 0.5rem",
          borderRadius: "0.25rem",
          fontSize: "0.875rem",
          fontWeight: "bold",
          ...style,
        }}
      >
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {role === "student-ssg-eventorganizer" ? (
          <NavbarStudentSSGEventOrganizer />
        ) : (
          <NavbarEventOrganizer />
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                border: "4px solid rgba(0, 0, 0, 0.1)",
                borderLeftColor: "#0d6efd",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                animation: "spin 1s linear infinite",
                margin: "0 auto 1rem",
              }}
            ></div>
            <p>Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {role === "student-ssg-eventorganizer" ? (
          <NavbarStudentSSGEventOrganizer />
        ) : (
          <NavbarEventOrganizer />
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{ textAlign: "center", padding: "2rem", maxWidth: "600px" }}
          >
            <p
              style={{
                color: "#dc3545",
                fontSize: "1.25rem",
                marginBottom: "1rem",
              }}
            >
              ❌ Error: {error}
            </p>
            <button
              style={{
                backgroundColor: "#0d6efd",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {role === "student-ssg-eventorganizer" ? (
        <NavbarStudentSSGEventOrganizer />
      ) : (
        <NavbarEventOrganizer />
      )}

      <div
        style={{
          flex: 1,
          padding: "1rem",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Manage Events</h1>
          <div style={{ position: "relative" }}>
            <input
              type="search"
              placeholder="Search events or locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                border: "1px solid #ced4da",
                width: "100%",
                minWidth: "250px",
              }}
            />
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              border: "1px dashed #ced4da",
              borderRadius: "0.25rem",
            }}
          >
            <p>No events found. Try a different search term.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1rem",
            }}
          >
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid #dee2e6",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.25rem" }}>
                    {event.name}
                  </h3>
                  {getStatusBadge(event.status)}
                </div>

                <div style={{ flex: 1, marginBottom: "1rem" }}>
                  <p style={{ margin: "0.5rem 0" }}>
                    <strong>Date:</strong> {formatDate(event.start_datetime)}
                  </p>
                  <p style={{ margin: "0.5rem 0" }}>
                    <strong>Location:</strong> {event.location}
                  </p>
                  <p style={{ margin: "0.5rem 0" }}>
                    <strong>Departments:</strong>{" "}
                    {event.departments?.map((d) => d.name).join(", ") || "None"}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => openEditModal(event)}
                    style={{
                      backgroundColor: "#0d6efd",
                      color: "white",
                      border: "none",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    Edit
                  </button>

                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setEventToUpdate(event.id);
                        setStatusToUpdate(e.target.value);
                        setStatusModalOpen(true);
                      }
                    }}
                    value=""
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #ced4da",
                      backgroundColor: "white",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    <option value="" disabled>
                      Change Status
                    </option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <button
                    onClick={() => {
                      setItemToDelete(event.id);
                      setDeleteModalOpen(true);
                    }}
                    style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Event Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onRequestClose={closeEditModal}
        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          },
          content: {
            position: "relative",
            inset: "auto",
            border: "none",
            background: "white",
            borderRadius: "0.5rem",
            padding: "0",
            width: "100%",
            maxWidth: "600px",
            maxHeight: "90vh",
            overflow: "auto",
          },
        }}
        ariaHideApp={false}
      >
        <div style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h2 style={{ margin: 0 }}>Edit Event</h2>
            <button
              onClick={closeEditModal}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#6c757d",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                Event Name
              </label>
              <input
                type="text"
                name="name"
                value={editingEvent?.name || ""}
                onChange={handleEditChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #ced4da",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "bold",
                  }}
                >
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="start_datetime"
                  value={
                    editingEvent?.start_datetime
                      ? new Date(editingEvent.start_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #ced4da",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "bold",
                  }}
                >
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="end_datetime"
                  value={
                    editingEvent?.end_datetime
                      ? new Date(editingEvent.end_datetime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={handleEditChange}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #ced4da",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                Location
              </label>
              <input
                type="text"
                name="location"
                value={editingEvent?.location || ""}
                onChange={handleEditChange}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #ced4da",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                Departments
              </label>
              <select
                multiple
                value={editingEvent?.department_ids?.map(String) || []}
                onChange={(e) => {
                  const options = Array.from(
                    e.target.selectedOptions,
                    (option) => Number(option.value)
                  );
                  setEditingEvent((prev) =>
                    prev ? { ...prev, department_ids: options } : null
                  );
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #ced4da",
                  minHeight: "100px",
                }}
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <small style={{ color: "#6c757d" }}>
                Hold Ctrl/Cmd to select multiple
              </small>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                Programs
              </label>
              <select
                multiple
                value={editingEvent?.program_ids?.map(String) || []}
                onChange={(e) => {
                  const options = Array.from(
                    e.target.selectedOptions,
                    (option) => Number(option.value)
                  );
                  setEditingEvent((prev) =>
                    prev ? { ...prev, program_ids: options } : null
                  );
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #ced4da",
                  minHeight: "100px",
                }}
              >
                {programs.map((program) => (
                  <option key={program.id} value={String(program.id)}>
                    {program.name}
                  </option>
                ))}
              </select>
              <small style={{ color: "#6c757d" }}>
                Hold Ctrl/Cmd to select multiple
              </small>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                Assign SSG Members
              </label>
              <select
                multiple
                value={editingEvent?.ssg_member_ids?.map(String) || []}
                onChange={(e) => {
                  const options = Array.from(
                    e.target.selectedOptions,
                    (option) => Number(option.value)
                  );
                  setEditingEvent((prev) =>
                    prev ? { ...prev, ssg_member_ids: options } : null
                  );
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #ced4da",
                  minHeight: "100px",
                }}
              >
                {ssgMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user.first_name} {member.user.last_name} (
                    {member.position})
                  </option>
                ))}
              </select>
              <small style={{ color: "#6c757d" }}>
                Hold Ctrl/Cmd to select multiple
              </small>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "1.5rem",
            }}
          >
            <button
              onClick={closeEditModal}
              style={{
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveEditedEvent}
              style={{
                backgroundColor: "#0d6efd",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Status Change Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onRequestClose={() => setStatusModalOpen(false)}
        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          },
          content: {
            position: "relative",
            inset: "auto",
            border: "none",
            background: "white",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            width: "100%",
            maxWidth: "400px",
          },
        }}
        ariaHideApp={false}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ margin: 0 }}>Update Status</h2>
            <button
              onClick={() => setStatusModalOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#6c757d",
              }}
            >
              ×
            </button>
          </div>

          <p style={{ marginBottom: "1.5rem" }}>
            Are you sure you want to change this event's status to{" "}
            <strong>{statusToUpdate?.toLowerCase()}</strong>?
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={() => setStatusModalOpen(false)}
              style={{
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={updateEventStatus}
              style={{
                backgroundColor: "#0d6efd",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onRequestClose={() => setDeleteModalOpen(false)}
        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          },
          content: {
            position: "relative",
            inset: "auto",
            border: "none",
            background: "white",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            width: "100%",
            maxWidth: "400px",
          },
        }}
        ariaHideApp={false}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ margin: 0 }}>Delete Event</h2>
            <button
              onClick={() => setDeleteModalOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#6c757d",
              }}
            >
              ×
            </button>
          </div>

          <p style={{ marginBottom: "1.5rem" }}>
            Are you sure you want to delete this event? This action cannot be
            undone.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={() => setDeleteModalOpen(false)}
              style={{
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageEvent;
