import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, TrendingUp } from 'lucide-react';
import { getBearerToken } from '../../utils/apiHelper';

const Deals = () => {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [employees, setEmployees] = useState([]);
  const [leads, setLeads] = useState([]);
  const [formData, setFormData] = useState({
    leadId: '',
    employeeId: '',
    dealName: '',
    value: 0,
    stage: 'Proposal',
    probability: 50,
    expectedCloseDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const token = getBearerToken();
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDeals();
    fetchEmployees();
    fetchLeads();
  }, [filterStage]);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const url = filterStage
        ? `/api/sales/deals/stage/${filterStage}`
        : '/api/sales/deals';
      const res = await axios.get(url, { headers });
      setDeals(res.data.data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('/api/employees', { headers });
      setEmployees(res.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await axios.get('/api/sales/leads', { headers });
      setLeads(res.data.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDeal) {
        await axios.patch(`/api/sales/deals/${editingDeal._id}`, formData, { headers });
      } else {
        await axios.post('/api/sales/deals', formData, { headers });
      }
      fetchDeals();
      setShowModal(false);
      setFormData({
        leadId: '',
        employeeId: '',
        dealName: '',
        value: 0,
        stage: 'Proposal',
        probability: 50,
        expectedCloseDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setEditingDeal(null);
    } catch (error) {
      console.error('Error saving deal:', error);
    }
  };

  const handleEdit = (deal) => {
    setEditingDeal(deal);
    setFormData({
      ...deal,
      expectedCloseDate: new Date(deal.expectedCloseDate).toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this deal?')) {
      try {
        await axios.delete(`/api/sales/deals/${id}`, { headers });
        fetchDeals();
      } catch (error) {
        console.error('Error deleting deal:', error);
      }
    }
  };

  const handleCloseDeal = async (id, stage) => {
    try {
      await axios.patch(`/api/sales/deals/${id}/close`, { stage }, { headers });
      fetchDeals();
    } catch (error) {
      console.error('Error closing deal:', error);
    }
  };

  const filteredDeals = deals.filter(deal =>
    deal.dealName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stageColors = {
    'Proposal': 'bg-blue-100 text-blue-800',
    'Negotiation': 'bg-yellow-100 text-yellow-800',
    'Closed Won': 'bg-green-100 text-green-800',
    'Closed Lost': 'bg-red-100 text-red-800'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deals</h1>
            <p className="text-gray-600 mt-2">Manage your sales pipeline</p>
          </div>
          <button
            onClick={() => {
              setEditingDeal(null);
              setFormData({
                leadId: '',
                employeeId: '',
                dealName: '',
                value: 0,
                stage: 'Proposal',
                probability: 50,
                expectedCloseDate: new Date().toISOString().split('T')[0],
                notes: ''
              });
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            Add Deal
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stages</option>
            <option value="Proposal">Proposal</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>
        </div>

        {/* Deals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">
              Loading deals...
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No deals found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deal Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lead</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Employee</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Value</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Stage</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Probability</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Close Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal._id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{deal.dealName}</td>
                    <td className="px-6 py-4 text-gray-600">{deal.lead?.name || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{deal.employee?.name || '-'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">${deal.value.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${stageColors[deal.stage] || 'bg-gray-100 text-gray-800'}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${deal.probability}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{deal.probability}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(deal.expectedCloseDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        onClick={() => handleEdit(deal)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(deal._id)}
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
                {editingDeal ? 'Edit Deal' : 'Add New Deal'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select
                  value={formData.leadId}
                  onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Lead</option>
                  {leads.map((lead) => (
                    <option key={lead._id} value={lead._id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
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
                <input
                  type="text"
                  placeholder="Deal Name"
                  value={formData.dealName}
                  onChange={(e) => setFormData({ ...formData, dealName: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Deal Value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Proposal">Proposal</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed Won">Closed Won</option>
                  <option value="Closed Lost">Closed Lost</option>
                </select>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Probability: {formData.probability}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                    {editingDeal ? 'Update' : 'Create'}
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

export default Deals;
