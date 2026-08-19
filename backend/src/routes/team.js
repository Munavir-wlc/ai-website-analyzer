const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Team = require('../models/Team');
const Scan = require('../models/Scan');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/team/create
// @desc    Create a new Multi-User Team Workspace
// @access  Private
router.post('/create', protect, async (req, res) => {
  const { name } = req.body;
  try {
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Team workspace name is required' });
    }

    const team = await Team.create({
      name: name.trim(),
      ownerId: req.user._id,
      members: [{ userId: req.user._id, role: 'owner', joinedAt: new Date() }]
    });

    res.status(201).json({ success: true, team });
  } catch (err) {
    console.error('[Team Route Error]:', err);
    res.status(500).json({ error: 'Failed to create team workspace' });
  }
});

// @route   GET /api/team/my-teams
// @desc    Get all teams current user belongs to
// @access  Private
router.get('/my-teams', protect, async (req, res) => {
  try {
    const teams = await Team.find({
      'members.userId': req.user._id
    })
      .populate('members.userId', 'name email')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(teams);
  } catch (err) {
    console.error('[Get Teams Error]:', err);
    res.status(500).json({ error: 'Failed to fetch team workspaces' });
  }
});

// @route   GET /api/team/my-invitations
// @desc    Get pending in-app team workspace invitations for current logged-in user
// @access  Private
router.get('/my-invitations', protect, async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const teamsWithInvites = await Team.find({
      'invites.email': userEmail,
      'invites.expiresAt': { $gt: new Date() }
    }).select('name invites ownerId').populate('ownerId', 'name email');

    const invitations = [];
    teamsWithInvites.forEach(team => {
      team.invites.forEach(invite => {
        if (invite.email === userEmail && invite.expiresAt > new Date()) {
          invitations.push({
            teamId: team._id,
            teamName: team.name,
            ownerName: team.ownerId?.name || 'Team Owner',
            role: invite.role,
            inviteToken: invite.inviteToken,
            expiresAt: invite.expiresAt
          });
        }
      });
    });

    res.json(invitations);
  } catch (err) {
    console.error('[Get My Invitations Error]:', err);
    res.status(500).json({ error: 'Failed to fetch pending invitations' });
  }
});

const { sendTeamInviteEmail } = require('../services/emailService');

// @route   POST /api/team/:teamId/invite
// @desc    Invite a new team member by email
// @access  Private (Owner/Admin only)
router.post('/:teamId/invite', protect, async (req, res) => {
  const { teamId } = req.params;
  const { email, role } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ error: 'Invited member email is required' });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team workspace not found' });
    }

    const callerMember = team.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!callerMember || (callerMember.role !== 'owner' && callerMember.role !== 'admin')) {
      return res.status(403).json({ error: 'Only team Owners and Admins can invite new members.' });
    }

    const targetEmail = email.toLowerCase().trim();
    const inviteToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const assignedRole = role === 'admin' ? 'admin' : 'member';

    team.invites.push({
      email: targetEmail,
      role: assignedRole,
      inviteToken,
      expiresAt
    });

    await team.save();

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/team?joinToken=${inviteToken}`;

    // Dispatch email to target recipient
    const emailResult = await sendTeamInviteEmail({
      toEmail: targetEmail,
      teamName: team.name,
      inviterName: req.user.name || 'Team Admin',
      role: assignedRole,
      inviteLink
    });

    res.json({
      success: true,
      message: `Invitation email sent to ${targetEmail}`,
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl || null,
      inviteToken,
      inviteLink
    });
  } catch (err) {
    console.error('[Invite Team Member Error]:', err);
    res.status(500).json({ error: 'Failed to generate invitation' });
  }
});

// @route   POST /api/team/join/:token
// @desc    Accept invitation and join team workspace
// @access  Private
router.post('/join/:token', protect, async (req, res) => {
  const { token } = req.params;
  try {
    const team = await Team.findOne({ 'invites.inviteToken': token });
    if (!team) {
      return res.status(404).json({ error: 'Invalid or expired invitation token' });
    }

    const invite = team.invites.find(i => i.inviteToken === token);
    if (!invite || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invitation token has expired' });
    }

    // Check if user is already a member
    const alreadyMember = team.members.some(m => m.userId.toString() === req.user._id.toString());
    if (!alreadyMember) {
      team.members.push({
        userId: req.user._id,
        role: invite.role,
        joinedAt: new Date()
      });
    }

    // Remove consumed invite token
    team.invites = team.invites.filter(i => i.inviteToken !== token);
    await team.save();

    res.json({ success: true, message: `Joined ${team.name} workspace successfully`, team });
  } catch (err) {
    console.error('[Join Team Error]:', err);
    res.status(500).json({ error: 'Failed to join team workspace' });
  }
});

// @route   GET /api/team/:teamId/scans
// @desc    Get shared team scan history (includes scans created by team members)
// @access  Private
router.get('/:teamId/scans', protect, async (req, res) => {
  const { teamId } = req.params;
  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team workspace not found' });

    const isMember = team.members.some(m => m.userId.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this team workspace' });
    }

    const memberUserIds = team.members.map(m => m.userId);

    const scans = await Scan.find({ teamId })
      .select('scanId url score grade scanMode createdAt report userId teamId')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(scans);
  } catch (err) {
    console.error('[Get Team Scans Error]:', err);
    res.status(500).json({ error: 'Failed to fetch team scans' });
  }
});

// @route   POST /api/team/move-scan/:scanId
// @desc    Move a scan between Personal and Team Workspaces
// @access  Private
router.post('/move-scan/:scanId', protect, async (req, res) => {
  const { scanId } = req.params;
  const { targetWorkspaceId } = req.body; // 'personal' or team Mongo ID

  try {
    const scan = await Scan.findOne({ scanId });
    if (!scan) return res.status(404).json({ error: 'Scan report not found' });

    // Verify ownership of the scan or admin status
    if (scan.userId && scan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the scan owner can move this report' });
    }

    if (!targetWorkspaceId || targetWorkspaceId === 'personal') {
      scan.teamId = null;
      await scan.save();
      return res.json({ success: true, message: 'Scan successfully moved to Personal Workspace', scan });
    }

    const team = await Team.findById(targetWorkspaceId);
    if (!team) return res.status(404).json({ error: 'Target team workspace not found' });

    const isMember = team.members.some(m => m.userId.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of the target team workspace' });
    }

    scan.teamId = team._id;
    await scan.save();

    res.json({ success: true, message: `Scan successfully moved to ${team.name} workspace`, scan });
  } catch (err) {
    console.error('[Move Scan Error]:', err);
    res.status(500).json({ error: 'Failed to move scan to workspace' });
  }
});

// @route   DELETE /api/team/:teamId/members/:memberId
// @desc    Remove member from team workspace
// @access  Private (Owner/Admin only)
router.delete('/:teamId/members/:memberId', protect, async (req, res) => {
  const { teamId, memberId } = req.params;
  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team workspace not found' });

    const caller = team.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!caller || (caller.role !== 'owner' && caller.role !== 'admin')) {
      return res.status(403).json({ error: 'Only team Owners and Admins can remove members.' });
    }

    team.members = team.members.filter(m => m.userId.toString() !== memberId);
    await team.save();

    res.json({ success: true, message: 'Member removed from team workspace' });
  } catch (err) {
    console.error('[Remove Member Error]:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
