import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { Users, ThumbsUp, MessageCircle, CheckCircle, FileText } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session) {
      fetchActivity();
    }
  }, [status, session, router]);

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/user/activity');
      const data = await res.json();
      setActivity(data);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Laddar...</div>
      </div>
    );
  }

  if (!session || !activity) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push('/')}
            className="mb-4 text-white hover:text-yellow-400 font-medium"
          >
            ← Tillbaka till hem
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Min aktivitet</h1>
              <p className="text-blue-100 text-sm">{session.user.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Förslag</span>
            </div>
            <p className="text-3xl font-bold text-blue-800">{activity.proposals.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Röster</span>
            </div>
            <p className="text-3xl font-bold text-green-800">{activity.thumbsUps.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">Kommentarer</span>
            </div>
            <p className="text-3xl font-bold text-purple-800">{activity.comments.length}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-gray-600">Slutröster</span>
            </div>
            <p className="text-3xl font-bold text-yellow-800">{activity.finalVotes.length}</p>
          </div>
        </div>

        {/* My Proposals */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Mina förslag ({activity.proposals.length})
          </h2>
          {activity.proposals.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-500">
              Du har inte skapat några förslag än
            </div>
          ) : (
            activity.proposals.map((proposal) => (
              <div key={proposal._id} className="bg-white rounded-2xl shadow-md p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-800 mb-2">{proposal.title}</h3>
                    <p className="text-gray-600">{proposal.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-4 h-4" />
                        {proposal.thumbsUpCount}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        {proposal.status === 'active' ? 'Aktiv' : proposal.status === 'top3' ? 'Topp 3' : 'Arkiverad'}
                      </span>
                      <span>{new Date(proposal.createdAt).toLocaleDateString('sv-SE')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* My Thumbs Up Votes */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ThumbsUp className="w-6 h-6" />
            Förslag jag röstat på ({activity.thumbsUps.length})
          </h2>
          {activity.thumbsUps.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-500">
              Du har inte röstat på några förslag än
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md p-6 space-y-3">
              {activity.thumbsUps.map((vote) => (
                <div key={vote._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{vote.proposalTitle}</span>
                  <span className="text-sm text-gray-500">{new Date(vote.createdAt).toLocaleDateString('sv-SE')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Comments */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            Mina kommentarer ({activity.comments.length})
          </h2>
          {activity.comments.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-500">
              Du har inte kommenterat på några förslag än
            </div>
          ) : (
            activity.comments.map((comment) => (
              <div key={comment._id} className="bg-white rounded-2xl shadow-md p-6">
                <p className="text-sm text-blue-600 font-medium mb-2">
                  På: {comment.proposalTitle}
                </p>
                <p className="text-gray-700">{comment.text}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(comment.createdAt).toLocaleDateString('sv-SE')}
                </p>
              </div>
            ))
          )}
        </div>

        {/* My Final Votes */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Mina slutröster ({activity.finalVotes.length})
          </h2>
          {activity.finalVotes.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-gray-500">
              Du har inte avgett några slutröster än
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md p-6 space-y-3">
              {activity.finalVotes.map((vote) => (
                <div key={vote._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{vote.proposalTitle}</span>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      vote.choice === 'yes' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {vote.choice === 'yes' ? 'Ja' : 'Nej'}
                    </span>
                    <span className="text-sm text-gray-500">{new Date(vote.createdAt).toLocaleDateString('sv-SE')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}