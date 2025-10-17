import { getSession } from 'next-auth/react';
import connectDB from '../../lib/mongodb';
import { Comment } from '../../lib/models';

export default async function handler(req, res) {
  await connectDB();

  if (req.method === 'GET') {
    const { proposalId } = req.query;

    if (!proposalId) {
      return res.status(400).json({ message: 'Proposal ID krävs' });
    }

    try {
      const comments = await Comment.find({ proposalId })
        .sort({ createdAt: -1 })
        .lean();

      const anonymizedComments = comments.map(comment => ({
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        authorName: comment.authorName,
        text: comment.text,
        createdAt: comment.createdAt
      }));

      return res.status(200).json(anonymizedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ message: 'Ett fel uppstod' });
    }
  }

  if (req.method === 'POST') {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ message: 'Du måste vara inloggad' });
    }

    const { proposalId, text } = req.body;

    if (!proposalId || !text) {
      return res.status(400).json({ message: 'Proposal ID och text krävs' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ message: 'Kommentaren är för lång (max 1000 tecken)' });
    }

    try {
      const comment = await Comment.create({
        proposalId,
        userId: session.user.id,
        authorName: session.user.name,
        text
      });

      return res.status(201).json({
        _id: comment._id.toString(),
        proposalId: comment.proposalId.toString(),
        authorName: comment.authorName,
        text: comment.text,
        createdAt: comment.createdAt
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      return res.status(500).json({ message: 'Ett fel uppstod vid skapande av kommentar' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}