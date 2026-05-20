// @ts-nocheck — sales portal typed separately; excluded from strict CI scope
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Phone, Clock } from 'lucide-react';
import { salesApi } from '../../utils/salesApi';

const Calls = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [employees, setEmployees] = useState([]);
  const [leads, setLeads] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    leadId: '',
    callDate: new Date().toISOString().split('T')[0],
    duration: 0,
    callType: 'Outbound',
    status: 'Connected',
    outcome: 'Cold',
    notes: ''
  });

  useEffect(() => {
    fetchCalls();
    fetchEmployees();
    fetchLeads();
  }, [filterStatus]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const url = filterStatus
        ? `/api/sales/calls?status=${filterStatus}`
        : '/api/sales/calls';
      const res = await salesApi.get<{ data?: unknown[] }>(url);
      setCalls((res as { data?: unknown[] })?.data || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await salesApi.get<{ data?: unknown[] }>('/api/employees');
      setEmployees((res as { data?: unknown[] })?.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await salesApi.get<{ data?: unknown[] }>('/api/sales/leads');
      setLeads((res as { data?: unknown[] })?.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCall) {
        await salesApi.patch(`/api/sales/calls/${editingCall._id}`, formData);
      } else {
        await salesApi.post('/api/sales/calls', formData);
      }
      fetchCalls();
      setShowModal(false);
      setFormData({
        employeeId: '',
        leadId: '',
        callDate: new Date().toISOString().split('T')[0],
        duration: 0,
        callType: 'Outbound',
        status: 'Connected',
        outcome: 'Cold',
        notes: ''
      });
      setEditingCall(null);
    } catch (error) {
      console.error('Error saving call:', error);
    }
  };

  const handleEdit = (call) => {
    setEditingCall(call);
    setFormData({
      ...call,
      callDate: new Date(call.callDate).toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this call?')) {
      try {
        await salesApi.delete(`/api/sales/calls/${id}`);
        fetchCalls();
      } catch (error) {
        console.error('Error deleting call:', error);
      }
    }
  };

  const filteredCalls = calls.filter(call =>
    call.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    'Connected': 'bg-green-100 text-green-800',
    'Missed': 'bg-red-100 text-red-800',
    'Voicemail': 'bg-yellow-100 text-yellow-800',
    'Declined': 'bg-gray-100 text-gray-800'
  };

  const outcomeColors = {
    'Hot': 'bg-red-100 text-red-800',
    'Warm': 'bg-orange-100 text-orange-800',
    'Cold': 'bg-blue-100 text-blue-800',
    'Not Interested': 'bg-gray-100 text-gray-800',
    'Follow-up': 'bg-purple-100 text-purple-800'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calls</h1>
            <p className="text-gray-600 mt-2">Track and manage all sales calls</p>
          </div>
          <button
            onClick={() => {
              setEditingCall(null);
              setFormData({
                employeeId: '',
                leadId: '',
                callDate: new Date().toISOString().split('T')[0],
                duration: 0,
                callType: 'Outbound',
                status: 'Connected',
                outcome: 'Cold',
                notes: ''
              });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            Log Call
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search calls..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="Connected">Connected</option>
            <option value="Missed">Missed</option>
            <option value="Voicemail">Voicemail</option>
            <option value="Declined">Declined</option>
          </select>
        </div>

        {/* Calls Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">
              Loading calls...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No calls found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lead</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Outcome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call) => (
                  <tr key={call._id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{call.employee?.name || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{call.lead?.name || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(call.callDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600 flex items-center gap-1">
                      <Clock size={16} />
                      {Math.floor(call.duration / 60)}m {call.duration % 60}s
                    </td>
                    <td className="px-6 py-4 text-gray-600">{call.callType}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[call.status] || 'bg-gray-100 text-gray-800'}`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${outcomeColors[call.outcome] || 'bg-gray-100 text-gray-800'}`}>
                        {call.outcome}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => handleEdit(call)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(call._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">
                {editingCall ? 'Edit Call' : 'Log New Call'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={formData.leadId}
                  onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Lead (Optional)</option>
                  {leads.map((lead) => (
                    <option key={lead._id} value={lead._id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={formData.callDate}
                  onChange={(e) => setFormData({ ...formData, callDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Duration (seconds)"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.callType}
                  onChange={(e) => setFormData({ ...formData, callType: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                </select>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Connected">Connected</option>
                  <option value="Missed">Missed</option>
                  <option value="Voicemail">Voicemail</option>
                  <option value="Declined">Declined</option>
                </select>
                <select
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
                <textarea
                  placeholder="Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                ></textarea>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    {editingCall ? 'Update' : 'Log Call'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calls;
